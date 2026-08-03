// ─── COMPONER: de un descriptor a un glifo que se puede CONTAR ──────────────
//
// Éste es el archivo que ataca la contra que el usuario aceptó al elegir el
// estilo: **el glifo aplana la estructura**. En Ánima I un objeto era un dibujo,
// así que una obra de seis piezas y una vara suelta se veían igual. Acá un
// objeto es la COMPOSICIÓN de sus piezas, y contar es mirar.
//
// ─── EL BUG QUE ESTE ARCHIVO YA TIENE ARREGLADO, Y CÓMO SE ENCONTRÓ ─────────
//
// La primera versión del layout ponía las piezas en una grilla fija y dejaba el
// hueco al final: con cinco piezas se dibujaban seis lugares y el último quedaba
// vacío. Suena razonable y **no distingue nada**. Un adversario lo implementó y
// lo midió: cinco partes contra seis, misma sustancia, difieren en
//
//     vara 16 · hebra 18 · grano 22 · bloque 38 · malla 40 · filete 62
//
// píxeles sobre 576. Y encontró que no es ruido sino una identidad: **si el
// layout de N=5 es el de N=6 menos una baldosa, lo único que cambia entre cinco
// y seis es esa baldosa**. Dieciséis píxeles sobre 576 es 2,8%: en Ánima I un
// fardo se veía igual que una vara suelta, y con ese layout seis se veían igual
// que cinco.
//
// La reparación es una línea de tabla: **la última fila va CENTRADA**, no
// alineada a la izquierda con un hueco a la derecha. Con eso, pasar de cinco a
// seis no agrega una baldosa: corre las dos de abajo y agrega una tercera, y el
// mínimo sobre las seis formas sube de 16 a 30.
//
// Lo que cuesta: la silueta deja de ser constante entre N=5 y N=6. Era un
// argumento a favor de una silueta que no se podía contar.
//
// ─── LO QUE EL DESCRIPTOR NO DICE, Y CÓMO SE REPARTE ────────────────────────
//
// El descriptor publica `materiales` ORDENADO Y SIN REPETIR, no la sustancia de
// cada parte, y es a propósito: el orden de las partes es un accidente de cómo
// se armó la obra (medido en el tramo C·bis del gate). Así que el dibujo no
// puede saber que la pieza 3 es de liana — y no debe.
//
// Lo que hace en cambio: **el núcleo manda y los demás aparecen**. La primera
// pieza va del color del núcleo, que es el de más masa y el que también manda en
// el nombre; las otras reparten los materiales restantes. Un observador ve de
// qué está hecho y en qué proporción manda, que es lo que el mundo sabe.

import type { Physics } from '@anima/physics'
import type { RenderDescriptor } from '@anima/world'

import { siluetaDe, type Mascara } from './forma.js'
import { aspectoDe, type Paleta, type Trama } from './paleta.js'
import { claveDeCriatura, claveDePieza, mascaraDe, type Sprites } from './sprite.js'

/**
 * UNA CAPA: una máscara, su paleta y dónde va.
 *
 * ─── POR QUÉ CAPAS Y NO UNA GRILLA SOLA ────────────────────────────────────
 *
 * Porque una grilla sola obliga a que todo el objeto comparta una paleta. Con
 * seis partes de materiales distintos y ocho juntas de tres atadores, un solo
 * plano de dígitos necesitaría un alfabeto extendido —índice 4 = material 1,
 * índice 7 = material 2…— y con eso se pierde la invariante que hace que esto
 * funcione: que quien dibuja elige volumen y jamás color.
 *
 * Con capas, cada una conserva sus tres tonos y el pintor las compone. El
 * alfabeto sigue siendo `0-3` para siempre.
 */
export interface Capa {
  readonly mascara: Mascara
  readonly paleta: Paleta
  readonly x: number
  readonly y: number
}

export interface Glifo {
  readonly grilla: number
  readonly capas: readonly Capa[]
}

/** El fuego y el hollín no son sustancias: son lo que le PASA a una. */
const PALETA_DEL_FUEGO: Paleta = { base: '#e8632a', sombra: '#a02a08', luz: '#ffc247' }
const PALETA_DEL_HOLLIN: Paleta = { base: '#3d3733', sombra: '#1a1614', luz: '#6b615a' }
const PALETA_DEL_AGUA: Paleta = { base: '#4fa5c9', sombra: '#1d5b78', luz: '#9bd8ee' }
const PALETA_DE_LO_PODRIDO: Paleta = { base: '#7a8f3a', sombra: '#48551f', luz: '#a8bd5e' }

/**
 * DÓNDE VA CADA PIEZA Y DE QUÉ TAMAÑO, para N de 1 a 6.
 *
 * ─── LAS POSICIONES SE DERIVAN DEL LADO, Y ES EL SEGUNDO BUG QUE ESTO TUVO ──
 *
 * La primera versión tenía una tabla de esquinas en unidades de tercio de
 * grilla, escrita a mano, y los lados en mitades. O sea: **cajas de 12 celdas
 * puestas cada 8**. Las piezas se montaban unas sobre otras, y como el solape
 * tapa lo que cambia, pasar de dos piezas a tres movía 24 celdas de 576 en la
 * hebra. El síntoma era el mismo del bug anterior —«no se puede contar»— y la
 * causa era otra, que es justamente por qué el test mide el resultado y no la
 * tabla.
 *
 * Acá el lado se elige primero y las esquinas salen de él, así que **el solape
 * es imposible por construcción** en vez de ser algo que hay que revisar.
 *
 * La fila de abajo de N=5 va CENTRADA, y ésa sí es una decisión: ver el
 * encabezado del archivo. Es lo que hace que pasar de cinco a seis corra las de
 * abajo en vez de agregar una baldosa en un hueco.
 */
function layout(n: number, grilla: number): { lado: number; lugares: readonly (readonly [number, number])[] } {
  const medio = Math.trunc(grilla / 2)
  const tercio = Math.trunc(grilla / 3)
  // Dos filas de un tercio, centradas verticalmente en la grilla.
  const arriba = Math.trunc((grilla - 2 * tercio) / 2)
  const abajo = arriba + tercio
  const sangria = Math.trunc(tercio / 2)

  switch (n) {
    case 1:
      return { lado: grilla, lugares: [[0, 0]] }
    case 2:
      return {
        lado: medio,
        lugares: [
          [0, Math.trunc(grilla / 4)],
          [medio, Math.trunc(grilla / 4)],
        ],
      }
    case 3:
      return {
        lado: tercio,
        lugares: [
          [0, tercio],
          [tercio, tercio],
          [2 * tercio, tercio],
        ],
      }
    case 4:
      return {
        lado: medio,
        lugares: [
          [0, 0],
          [medio, 0],
          [0, medio],
          [medio, medio],
        ],
      }
    case 5:
      return {
        lado: tercio,
        lugares: [
          [0, arriba],
          [tercio, arriba],
          [2 * tercio, arriba],
          [sangria, abajo],
          [tercio + sangria, abajo],
        ],
      }
    default:
      return {
        lado: tercio,
        lugares: [
          [0, arriba],
          [tercio, arriba],
          [2 * tercio, arriba],
          [0, abajo],
          [tercio, abajo],
          [2 * tercio, abajo],
        ],
      }
  }
}

/**
 * EL GLIFO DE UN CUERPO. Total: todo descriptor da uno, siempre.
 *
 * `grilla` entra por parámetro y no es una constante del módulo porque **cuál es
 * la buena todavía no se midió**: el criterio son 16, 24 o 32 y lo decide el
 * banco, no una opinión. 24 es el valor con el que se está trabajando.
 */
export function glifoDe(
  d: RenderDescriptor,
  phys: Physics,
  grilla = 24,
  sprites?: Sprites,
  /**
   * SI ESTE CUERPO ES DE ALGUIEN QUE ACTÚA. Lo sabe la escena
   * (`ActorEnEscena.body`) y no el descriptor, así que entra por acá y no por el
   * dato. El descriptor describe un CUERPO; que el cuerpo sea de un agente es
   * una relación, y las relaciones viven en la escena — la misma razón por la
   * que `heldBy` tampoco está adentro del descriptor.
   */
  esAgente = false,
): Glifo {
  const capas: Capa[] = []
  // Total quiere decir total: un descriptor imposible —cero partes, o más que
  // `MAX_PARTS`— tampoco puede tirar. Se dibuja con el layout del extremo.
  const n = d.partes < 1 ? 1 : d.partes > 6 ? 6 : d.partes
  const { lado, lugares } = layout(n, grilla)

  // El NÚCLEO manda: es el de más masa y el que también manda en el nombre. Las
  // otras piezas reparten el resto de los materiales, en el orden canónico.
  const otros = d.materiales.filter((m) => m !== d.nucleo)
  for (let i = 0; i < lugares.length; i++) {
    const lugar = lugares[i]
    if (lugar === undefined) continue
    const material = i === 0 || otros.length === 0 ? d.nucleo : otros[(i - 1) % otros.length]
    const a = aspectoDe(material ?? d.nucleo, phys)
    const mascara = piezaDe(d.forma, material ?? d.nucleo, lado, a.trama, sprites, esAgente)
    capas.push({ mascara, paleta: a.paleta, x: lugar[0], y: lugar[1] })
  }

  // ─── LOS NUDOS ──────────────────────────────────────────────────────────
  //
  // Uno por junta, del color de SU atador. Es el dato que existía desde el Hito
  // 1 (`Joint.via`) y que ninguna vista leyó nunca: cuando la criatura ata seis
  // yescas con junco, los cinco nudos se ven, y se ven de junco.
  const nudo = grilla >= 24 ? 3 : 2
  for (let j = 0; j < d.atadores.length; j++) {
    const atador = d.atadores[j]
    if (atador === undefined) continue
    const a = aspectoDe(atador, phys)
    // Entre pieza j y pieza j+1. Con más juntas que uniones visibles, vuelven a
    // empezar: es honesto porque el descriptor tampoco dice qué junta une a qué.
    const entre = lugares.length <= 1 ? 0 : j % (lugares.length - 1)
    const desde = lugares[entre]
    const hasta = lugares[entre + 1]
    if (desde === undefined || hasta === undefined) continue
    capas.push({
      mascara: masaLlena(nudo, nudo),
      paleta: a.paleta,
      x: Math.trunc((desde[0] + hasta[0]) / 2 + (lado - nudo) / 2),
      y: Math.trunc((desde[1] + hasta[1]) / 2 + (lado - nudo) / 2),
    })
  }

  // ─── PUESTO Y TRABAJANDO, Y LO QUE RETUVO ───────────────────────────────
  //
  // Los casos 4 y 5 de los siete del Hito 12C. El descriptor los publica desde el
  // gate —`desplegado: { captura }`— y **ninguna vista los leía**: una trampa
  // guardada en la mano y la misma trampa PUESTA en el río se dibujaban idénticas,
  // aunque una está trabajando y la otra no. Medido en
  // `los-siete-del-objeto-emergente`: de los cinco estados de cuerpo salían tres
  // dibujos.
  //
  // La convención es una BASE debajo del objeto, y es cosmética a propósito —de
  // eso trata esta capa entera— pero no arbitraria: lo desplegado es lo que está
  // asentado y funcionando, así que se dibuja apoyado. Sobre esa base, la captura
  // pone una marca de luz por pieza retenida, que es exactamente lo que el
  // descriptor cuenta.
  if (d.desplegado !== undefined) capas.push(...laBase(d.desplegado.captura, grilla))

  const marca = capaDeEstado(d, grilla)
  if (marca !== undefined) capas.push(marca)
  if (d.podrido === true) {
    capas.push({ mascara: motas(grilla), paleta: PALETA_DE_LO_PODRIDO, x: 0, y: 0 })
  }
  return { grilla, capas }
}

/**
 * LA SILUETA DE UNA PIEZA: la que dibujó el modelo si ya está, la del motor si no.
 *
 * ─── LAS DOS REGLAS DE ESTA FUNCIÓN, Y SON TODO EL DISEÑO ──────────────────
 *
 *   1. **NUNCA ESPERA.** `dameYa` mira lo que hay en memoria y contesta o no
 *      contesta. Si falta, se ENCOLA el pedido y se dibuja procedural en el
 *      acto. Un cuadro no puede depender de la red, y ésa es la mitad del
 *      pedido: que el mundo se vea desde el primer tick y el dibujo del modelo
 *      aparezca cuando esté, sin que nadie mire una pantalla vacía;
 *   2. **LO PROCEDURAL NO ES UN PLAN B, ES EL PISO.** Toda pieza tiene dibujo
 *      siempre, y por eso el sprite se puede reemplazar, tardar o no llegar
 *      nunca sin que nada se rompa. Es la regla 2 del ADR II-0017: el fallback
 *      es obligatorio.
 *
 * Y una que se ve por omisión: acá no hay ninguna reducción. Si el modelo
 * dibujó la pieza a 24 y esta pieza se dibuja a 8, **no se usa** — se pide la de
 * 8. Reducir rompe la esbeltez, y eso está medido en `forma.ts`.
 */
function piezaDe(
  forma: RenderDescriptor['forma'],
  sustancia: string,
  lado: number,
  trama: Trama,
  sprites?: Sprites,
  esAgente = false,
): Mascara {
  if (sprites === undefined) return siluetaDe(forma, lado, trama)
  // Una criatura pide un dibujo de criatura, no uno de la materia de la que
  // está hecha. Ver `claveDeCriatura` para por qué esto no inventa un tipo.
  const clave = esAgente ? claveDeCriatura(sustancia, lado) : claveDePieza(forma, sustancia, lado)
  const s = sprites.dameYa(clave)
  if (s !== undefined) return mascaraDe(s)
  sprites.pedir(clave)
  return siluetaDe(forma, lado, trama)
}

/**
 * LAS CAPAS, APLASTADAS A COLORES. Cada celda es un hex o `''` si no hay nada.
 *
 * No es sólo para los tests: es lo que hace cualquier renderer, y tenerlo acá
 * evita que cada cliente invente su propio orden de composición. Las capas se
 * pintan **en orden**, y la última gana — por eso el fuego va después del
 * cuerpo y el hollín después de todo.
 *
 * Una celda de índice `0` no pinta y tampoco borra: deja ver lo de abajo. Es la
 * mitad de lo que hace que las capas sirvan.
 */
export function pintar(g: Glifo): readonly (readonly string[])[] {
  const lienzo: string[][] = []
  for (let y = 0; y < g.grilla; y++) lienzo.push(new Array<string>(g.grilla).fill(''))

  for (const capa of g.capas) {
    for (let y = 0; y < capa.mascara.length; y++) {
      const fila = capa.mascara[y]
      if (fila === undefined) continue
      for (let x = 0; x < fila.length; x++) {
        const i = fila.charAt(x)
        if (i === '0') continue
        const destino = lienzo[capa.y + y]
        if (destino === undefined || capa.x + x < 0 || capa.x + x >= g.grilla) continue
        destino[capa.x + x] = i === '2' ? capa.paleta.sombra : i === '3' ? capa.paleta.luz : capa.paleta.base
      }
    }
  }
  return lienzo
}

/** Cuántas celdas difieren entre dos pinturas del mismo tamaño. */
export function celdasDistintas(a: readonly (readonly string[])[], b: readonly (readonly string[])[]): number {
  let n = 0
  for (let y = 0; y < a.length; y++) {
    const fa = a[y]
    const fb = b[y]
    if (fa === undefined || fb === undefined) continue
    for (let x = 0; x < fa.length; x++) if (fa[x] !== fb[x]) n++
  }
  return n
}

/**
 * LO QUE LE PASA A UNA COSA, como una capa encima y no como un tinte.
 *
 * Teñir la paleta habría sido más corto y rompe la invariante: un leño ardiendo
 * dejaría de ser del color de la madera. Encima, mezclar colores pide aritmética
 * que la regla 2 prohíbe. Una capa aparte dice «esto le está pasando a esto» sin
 * tocar de qué está hecho.
 */
function capaDeEstado(d: RenderDescriptor, grilla: number): Capa | undefined {
  switch (d.estado) {
    case 'ardiendo':
      return { mascara: llama(grilla), paleta: PALETA_DEL_FUEGO, x: 0, y: 0 }
    case 'consumido':
    case 'quemado':
    case 'chamuscado':
      return { mascara: hollin(grilla, d.estado === 'chamuscado' ? 3 : 2), paleta: PALETA_DEL_HOLLIN, x: 0, y: 0 }
    case 'mojado':
      return { mascara: gotas(grilla), paleta: PALETA_DEL_AGUA, x: 0, y: 0 }
    default:
      // `crudo`, `asado`, `a-medio-cocinar` y `sin-marca` no agregan capa: el
      // color de la carne y su cocción ya están en la familia y en la trama.
      return undefined
  }
}

/**
 * LA BASE DE LO DESPLEGADO, y la cuenta de lo que retuvo.
 *
 * Dos capas y no una, y por eso son casos distintos del criterio: la BASE dice
 * «está puesto y trabajando» y sale sí o sí; las MARCAS dicen cuánto atrapó y
 * sólo salen si atrapó algo. Una trampa recién puesta y una con dos peces tienen
 * que verse distinto, porque son estados distintos del mundo.
 *
 * Va en la fila de abajo del cuadro y ocupa el ancho entero: es lo que hace que
 * se lea como asentado y no como una pieza más. Las marcas van encima de la
 * base, una por pieza, separadas — a partir de tres se amontonarían, así que se
 * topan y se dice acá: lo que el jugador necesita saber es «atrapó», no cuántos
 * exactamente, y el número exacto lo tiene el panel de inspección.
 */
function laBase(captura: number, grilla: number): readonly Capa[] {
  const alto = grilla >= 24 ? 2 : 1
  const base: Capa = {
    mascara: Array.from({ length: alto }, () => '2'.repeat(grilla)),
    paleta: PALETA_DE_LA_BASE,
    x: 0,
    y: grilla - alto,
  }
  if (captura <= 0) return [base]

  const cuantas = captura > MARCAS_MAXIMAS ? MARCAS_MAXIMAS : captura
  const paso = Math.trunc(grilla / (cuantas + 1))
  const marcas: Capa[] = []
  for (let i = 0; i < cuantas; i++) {
    marcas.push({ mascara: ['3'], paleta: PALETA_DE_LA_BASE, x: paso * (i + 1), y: grilla - alto })
  }
  return [base, ...marcas]
}

/** La base es sombra del suelo, no de la materia: no la pinta ninguna sustancia. */
const PALETA_DE_LA_BASE: Paleta = { base: '#4a4640', sombra: '#2b2825', luz: '#c9b98a' }

/** A partir de acá las marcas se amontonan. Ver `laBase`. */
const MARCAS_MAXIMAS = 4

function masaLlena(ancho: number, alto: number): Mascara {
  const filas: string[] = []
  for (let y = 0; y < alto; y++) {
    let f = ''
    for (let x = 0; x < ancho; x++) f += y === 0 ? '3' : y === alto - 1 ? '2' : '1'
    filas.push(f)
  }
  return filas
}

/** Lenguas de fuego: más altas en el medio, y siempre arriba del cuerpo. */
function llama(g: number): Mascara {
  const alto = Math.max(2, Math.trunc(g / 3))
  const filas: string[] = []
  for (let y = 0; y < g; y++) {
    let f = ''
    for (let x = 0; x < g; x++) {
      const centro = x > g / 4 && x < (g * 3) / 4
      const dentro = y < (centro ? alto : Math.trunc(alto / 2))
      f += dentro && (x + y) % 2 === 0 ? (y === 0 ? '3' : '1') : '0'
    }
    filas.push(f)
  }
  return filas
}

/** Manchas de hollín. `paso` chico = más tapado. */
function hollin(g: number, paso: number): Mascara {
  const filas: string[] = []
  for (let y = 0; y < g; y++) {
    let f = ''
    for (let x = 0; x < g; x++) f += (x * 3 + y * 7) % paso === 0 ? '2' : '0'
    filas.push(f)
  }
  return filas
}

/** Gotas: pocas, abajo, y con brillo. */
function gotas(g: number): Mascara {
  const filas: string[] = []
  for (let y = 0; y < g; y++) {
    let f = ''
    for (let x = 0; x < g; x++) f += y > g / 2 && (x * 5 + y * 3) % 11 === 0 ? '3' : '0'
    filas.push(f)
  }
  return filas
}

/** Motas de lo que se pudre. */
function motas(g: number): Mascara {
  const filas: string[] = []
  for (let y = 0; y < g; y++) {
    let f = ''
    for (let x = 0; x < g; x++) f += (x * 7 + y * 5) % 13 === 0 ? '1' : '0'
    filas.push(f)
  }
  return filas
}
