// ─── CON QUIÉN ESTÁ HABLANDO ESTA PARTIDA ───────────────────────────────────
//
// El juego se apoya en dos modelos que no hacen lo mismo y hasta hoy no había
// dónde verlo:
//
//   **Codex** hace los tres trabajos que este juego le pide a un modelo, y los
//   tres salen por el depósito y terminan en un `codex exec`: dibuja los sprites
//   que faltan, lee las frases que el léxico no alcanza, y escribe las
//   habilidades que la criatura no tiene;
//   **Claude** está instalado y el juego no le habla. No es un olvido: los tres
//   puertos ya tienen dueño, y ponerlo a competir por uno sería una decisión de
//   producto que nadie tomó.
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
//
// ═══ Y LA CUARTA MENTIRA, QUE ES LA QUE SE PAGÓ MÁS CARO ═══════════════════
//
// «Vive · en espera» es cierto y alcanza mientras el juego NO le hable. El día
// que le habla —o que quiere hablarle— deja de alcanzar: en una partida medida,
// la criatura pidió ayuda dos veces, el pedido no salió del cuarto, y arriba
// seguía diciendo «vive · en espera» con la lámpara prendida. Nadie mintió; las
// dos palabras eran de un mundo donde nadie había intentado nada todavía.
//
// De ahí sale la cuarta luz. `no` es «el CLI no está» y es una respuesta del
// sondeo; `cortado` es «el CLI está y el juego no le llegó», y ésa no la sabe el
// sondeo: la sabe `Ordenes`, que es la que intentó. Son dos hechos distintos y
// por eso no comparten clase.

import type { IntentoAlModelo } from './ordenes.js'

/** Los cuatro estados de una luz, que son las cuatro clases del CSS. */
export type Luz = 'buscando' | 'vive' | 'no' | 'cortado'

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
function elDeCodex(
  m: Sondeado | undefined,
  dibuja: string | undefined,
  contesta: string | undefined,
  forja: string | undefined,
): Lampara {
  if (m === undefined) return BUSCANDO_UNO
  if (!m.vive) {
    return {
      luz: 'no',
      rol: 'no está',
      detalle: 'el CLI de Codex no contesta en la máquina del depósito: los dibujos salen procedurales',
    }
  }
  // ─── LOS DOS TRABAJOS SE MIRAN POR SEPARADO ─────────────────────────────
  //
  // Y no es simetría de adorno: un depósito puede tener dibujante y no querer
  // gastar consultas de texto, o al revés. Mientras Codex hizo una sola cosa, el
  // rol podía ser una palabra. Ahora son dos permisos y hay cuatro estados, así
  // que la palabra sale de cruzarlos en vez de estar escrita.
  const hace = [
    dibuja === 'codex' ? 'dibuja' : undefined,
    contesta === 'codex' ? 'contesta' : undefined,
    forja === 'codex' ? 'forja' : undefined,
  ].filter((x): x is string => x !== undefined)
  if (hace.length === 0) {
    return {
      luz: 'vive',
      rol: 'no se usa acá',
      detalle: conVersion('el CLI está, pero este depósito no lo usa para nada: sólo guarda y reparte', m),
    }
  }
  // Con tres, «dibuja, contesta y forja»: la coma es lo que evita que se lea
  // como dos cosas cuando son tres.
  const queHace = hace.length === 3 ? `${hace[0] ?? ''}, ${hace[1] ?? ''} y ${hace[2] ?? ''}` : hace.join(' y ')
  return {
    luz: 'vive',
    rol: queHace,
    detalle: conVersion(
      hace.length > 1
        ? `lo que le falta a la criatura —${queHace}— sale por el depósito a Codex, a tu cuenta`
        : queHace === 'dibuja'
          ? 'los sprites que faltan se los pide el depósito a Codex, de a uno y a tu cuenta'
          : queHace === 'contesta'
            ? 'las frases que la criatura no entiende se las lee Codex por el depósito, a tu cuenta'
            : 'las habilidades que la criatura no tiene se las escribe Codex por el depósito, a tu cuenta',
      m,
    ),
  }
}

/**
 * CLAUDE: la luz honesta del par. Prendida significa que el CLI está, y nada
 * más — el juego todavía no le manda una sola frase. El rol lo dice con las
 * palabras más cortas que encontré y el detalle explica por qué.
 *
 * El detalle ya cambió dos veces y las dos por lo mismo: decía qué era lo que
 * NADIE hacía, y cada vez que un puerto se enchufó dejó de ser cierto. Primero
 * fue «lo que decís lo entiende el léxico del propio juego» —hasta que Codex
 * empezó a leer el chat— y después «falta que alguien le escriba las habilidades
 * que no tiene», hasta que se enchufó la fragua. Ahora dice quién los hace, que
 * es lo único que no se vence.
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
      'el CLI está listo y el juego no le habla: los tres trabajos que necesita —dibujar, leer lo que decís y escribir lo que no sabe hacer— hoy los hace Codex',
      m,
    ),
  }
}

/**
 * ═══ LO QUE SE DICE CUANDO EL JUEGO QUISO IR AL MODELO Y NO LLEGÓ ══════════
 *
 * Tres textos del mismo hecho, y son tres porque los lee gente en tres momentos
 * distintos:
 *
 *   · **`rol`** — dos palabras al lado del nombre, para el que pasa por ahí y
 *     mira la lámpara de reojo;
 *   · **`detalle`** — la frase entera, para el que se detuvo y dejó el mouse
 *     encima porque quiere saber qué pasa;
 *   · **`cartel`** — lo que aparece SOLO, en el momento, para el que no estaba
 *     mirando. Es el único que interrumpe, así que es el que tiene que decir qué
 *     se perdió y no cómo está cableado el programa.
 *
 * ─── POR QUÉ «NO TRAJO NADA» NO DICE QUE NO LLEGÓ ──────────────────────────
 *
 * Porque llegó. El modelo contestó y dijo que no tenía nada mejor, y eso es una
 * respuesta legítima que se parece a una falla sólo desde la pantalla. Meterla en
 * el mismo texto que el cable desenchufado sería volver a hacer lo que este
 * archivo vino a arreglar: dos hechos distintos con las mismas palabras.
 */
export interface ElAvisoDeQueNoLlego {
  readonly rol: string
  readonly detalle: string
  /** La línea del cartel, sin el «sobre». Va aparte para poder pintarlo en gris. */
  readonly cartel: string
  /** La frase o la meta que quedó sin atender. Vacío cuando no aporta. */
  readonly sobre: string
}

/**
 * QUÉ QUERÍA EL JUEGO, en tercera persona.
 *
 * El `detalle` habla DEL JUEGO —«el juego quiso…»— y el `cartel` habla como la
 * criatura —«te habría preguntado»—. Una sola frase para los dos mezclaba las
 * dos voces en el medio de la oración: «el juego quiso que me lea mejor lo que
 * dijiste» tiene un «me» que no es de nadie.
 */
function loQueQueria(para: IntentoAlModelo['para']): string {
  return para === 'entender' ? 'releer mejor lo que dijiste' : 'que le escribieran lo que no sabe hacer'
}

export function elAvisoDeQueNoLlego(i: IntentoAlModelo): ElAvisoDeQueNoLlego {
  const sobre = i.sobre
  if (i.porque === 'se-cayo') {
    return {
      rol: 'se cortó',
      detalle: `el juego le habló para ${loQueQueria(i.para)} y el viaje falló`,
      cartel: 'le hablé al modelo y se cortó',
      sobre,
    }
  }
  if (i.porque === 'no-trajo-nada') {
    return {
      rol: 'no trajo nada',
      detalle: `el modelo contestó, pero sin nada mejor de lo que el juego ya tenía`,
      cartel: 'le pregunté al modelo y no trajo nada nuevo',
      sobre,
    }
  }
  return {
    rol: 'no le llega',
    // La palabra «puerto» y no «no está configurado»: lo que falta es una línea
    // que le pase la función a `Ordenes`, y decirlo así es lo que convierte el
    // aviso en algo que se puede ir a arreglar.
    detalle: `el CLI está listo, pero el juego no tiene el puerto enchufado: quiso ${loQueQueria(i.para)} y no salió de acá`,
    // ─── SIN NOMBRE PROPIO ADENTRO, y eso lo arregló un rediseño ───────────
    //
    // Decía «te habría preguntado a Claude». Servía mientras Claude era el único
    // hueco abierto; el día que Codex empezó a leer el chat pasó a nombrar al
    // que no tenía nada que ver. Y el nombre no hace falta acá: la lámpara que
    // se marca ES la del que tenía que atender, así que decirlo también en el
    // cartel es repetirlo, y repetirlo mal cuando cambia el cableado.
    cartel:
      i.para === 'entender'
        ? 'te habría preguntado y no tengo a quién'
        : 'necesito algo que no sé hacer y no tengo a quién pedírselo',
    sobre,
  }
}

/**
 * De lo que contestó `/salud` a lo que se ve. `undefined` es «no contestó», y se
 * pinta apagado y no buscando: el depósito caído es una respuesta.
 *
 * El segundo parámetro es el último intento que no llegó, y **pisa la lámpara de
 * Claude**. Va acá y no en una función aparte porque la lámpara es una sola: dos
 * funciones escribiendo el mismo `<p>` es cómo se llega a que una tape a la otra
 * según cuál corrió último.
 */
/**
 * ═══ A QUIÉN LE CORRESPONDÍA ATENDER ESE INTENTO ═══════════════════════════
 *
 * La pregunta que hay que contestar antes de prender ninguna luz, y la primera
 * versión de este tramo ni se la hizo: marcaba a Claude siempre, porque cuando
 * se escribió el único hueco abierto era el suyo. El día que Codex empezó a leer
 * el chat, eso pasó a ser la misma mentira dada vuelta — la luz culpando al que
 * no tenía nada que ver.
 *
 * Y no se adivina: sale del dato. `/salud` publica QUIÉN contesta el chat en este
 * depósito, y de ahí salen los tres casos:
 *
 *   · **entender** → el que `/salud` anuncia en `contesta`;
 *   · **aprender** → el que anuncia en `forja`. Vino después y por el mismo
 *     camino, tal como esta función decía que iba a pasar: el día que el hueco de
 *     la fragua se llenara, se enteraría por donde se enteró de `contesta`;
 *   · **y si para ese trabajo no hay nadie anunciado → ninguna.** Que no haya
 *     dueño es información, y ensuciar una lámpara ajena la escondería. Lo dicen
 *     la nota y el cartel.
 *
 * Son dos campos y no uno porque son dos permisos: un depósito puede contestar el
 * chat —que es barato— y no querer pagar una forja, que es un viaje largo más un
 * typecheck por candidata.
 */
function aQuienLeTocaba(
  i: IntentoAlModelo,
  quienHace: { readonly contesta: string | undefined; readonly forja: string | undefined },
): 'codex' | 'claude' | undefined {
  const dueño = i.para === 'entender' ? quienHace.contesta : quienHace.forja
  if (dueño === 'codex') return 'codex'
  if (dueño === 'claude') return 'claude'
  return undefined
}

/**
 * LA LÁMPARA DEL QUE TENÍA QUE ATENDER, CRUZADA CON LO QUE PASÓ.
 *
 * ─── LA LUZ NO SIEMPRE CAMBIA, Y ÉSE ES EL PUNTO ───────────────────────────
 *
 * `cortado` quiere decir «está y no le llegué», así que sólo tiene sentido sobre
 * una lámpara PRENDIDA. Si el sondeo ya dijo que el CLI no está, esa es la
 * explicación más fuerte y la que hay que dejar a la vista: pisarla con `cortado`
 * mandaría a buscar un cable cuando lo que falta es el programa. En ese caso el
 * intento no se pierde —se suma al detalle— pero no se roba la luz.
 *
 * Y con `buscando` tampoco: el sondeo todavía no volvió, así que no se sabe si
 * hay CLI. Prometer un diagnóstico ahí es adivinar.
 */
function conLoQueNoLlego(base: Lampara, i: IntentoAlModelo): Lampara {
  const a = elAvisoDeQueNoLlego(i)
  if (base.luz !== 'vive') {
    return { ...base, detalle: `${base.detalle} — y el juego le quiso hablar: ${a.cartel}` }
  }
  return { luz: 'cortado', rol: a.rol, detalle: a.detalle }
}

/**
 * LA NOTA DE ABAJO, que con un intento fallido pasa a tener siempre algo que decir.
 *
 * ─── LLEVA EL `detalle` Y NO EL `cartel`, Y SE VIO EN UNA CAPTURA ──────────
 *
 * Los dos textos se dibujan a tres píxeles de distancia: la nota queda entre la
 * lámpara y el cartel. Con el mismo texto en los dos, la pantalla decía «te
 * habría preguntado a Claude y no tengo cómo» dos veces seguidas, una en gris y
 * otra en un recuadro, y leer lo mismo dos veces se lee como un defecto de
 * render y no como énfasis.
 *
 * Repartidos, cada uno hace lo suyo: el cartel dice QUÉ SE PERDIÓ y se va; la
 * nota dice POR QUÉ y se queda. Y es el mismo texto que hasta hoy sólo se podía
 * leer dejando el mouse encima de la lámpara, o sea el que nadie leía.
 */
/**
 * ═══ Y LA QUINTA MENTIRA, QUE LLEGÓ CON LA CANILLA CERRADA ═════════════════
 *
 * Las dos lámparas hablan de LA MÁQUINA DEL DEPÓSITO, y siguen sin mentir: si
 * ese depósito no usa a Codex para nada, «no se usa acá» es exactamente cierto.
 *
 * Lo que dejó de ser cierto es lo que el panel ENTERO da a entender. Desde que
 * el jugador puede traer su propia API (ADR 0089), la partida puede estar
 * pensando con un modelo del que estas dos luces no saben nada — y un panel que
 * se llama «con quién está hablando» y no lo dice tiene un agujero del tamaño
 * de la única mente que hay.
 *
 * Va en la nota y no en una tercera lámpara a propósito: una lámpara promete un
 * sondeo, y acá no hay ninguno. Que la API esté configurada no dice que ande —
 * eso recién se sabe cuando se la usa, y entonces habla `noLlego`.
 */
function laNota(i: IntentoAlModelo | undefined, ninguno: boolean, mia: boolean): string {
  // El intento fallido manda: es lo más nuevo y lo más accionable.
  if (i !== undefined) return elAvisoDeQueNoLlego(i).detalle
  if (mia) return 'esta partida piensa con tu propia API, no con la cuenta del depósito'
  return ninguno ? 'se juega igual, con los dibujos del motor' : ''
}

export function conQuien(crudo: unknown, noLlego?: IntentoAlModelo, miApiPuesta = false): ConQuien {
  if (typeof crudo !== 'object' || crudo === null) {
    const apagado: Lampara = {
      luz: 'no',
      rol: 'sin depósito',
      detalle: 'el depósito no contesta, así que no hay forma de saber qué modelos hay',
    }
    // Sin depósito no se sabe quién atendía, así que no se marca a nadie: el
    // aviso sale por la nota. Y no es un caso raro — es EL caso, porque sin
    // depósito el proveedor del chat tampoco tiene por dónde salir.
    return { codex: apagado, claude: apagado, nota: laNota(noLlego, true, miApiPuesta) }
  }
  const o = crudo as Record<string, unknown>
  const dibuja = typeof o['dibuja'] === 'string' ? o['dibuja'] : undefined
  // Un depósito viejo no manda `contesta`, y ahí `undefined` es lo correcto: no
  // contesta porque esa ruta no existe todavía. No hace falta un caso especial.
  const contesta = typeof o['contesta'] === 'string' ? o['contesta'] : undefined
  const forja = typeof o['forja'] === 'string' ? o['forja'] : undefined
  const modelos = typeof o['modelos'] === 'object' && o['modelos'] !== null
    ? (o['modelos'] as Record<string, unknown>)
    : undefined

  const base = {
    codex: elDeCodex(modelos === undefined ? undefined : leerModelo(modelos['codex']), dibuja, contesta, forja),
    claude: elDeClaude(modelos === undefined ? undefined : leerModelo(modelos['claude'])),
  }
  const quien = noLlego === undefined ? undefined : aQuienLeTocaba(noLlego, { contesta, forja })
  const marcada = quien === undefined || noLlego === undefined ? base : { ...base, [quien]: conLoQueNoLlego(base[quien], noLlego) }
  // Se mide sobre `base` y no sobre lo marcado: la aclaración de abajo existe
  // para el caso de las dos apagadas, y `cortado` no es apagada — es prendida
  // con un problema. Con la luz nueva, `luz === 'no'` dejaría de ser cierto
  // justo cuando hay MÁS que aclarar, no menos.
  const ninguno = base.codex.luz === 'no' && base.claude.luz === 'no'
  return { ...marcada, nota: laNota(noLlego, ninguno, miApiPuesta) }
}
