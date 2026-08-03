// ─── LA SILUETA: de una forma y un tamaño, a una máscara de índices ─────────
//
// El segundo eje del dibujo. La familia dice de qué color; esto dice qué figura.
//
// ─── POR QUÉ LOS PATRONES SON FUNCIONES Y NO BITMAPS ────────────────────────
//
// En Ánima I un patrón era un dato: nueve glifos de 16×16 escritos a mano. Acá
// la primera versión iba a hacer lo mismo en 24×24 y **reducir** cuando la pieza
// entrara en una caja más chica, y eso se midió antes de escribirlo. Los dos
// resultados, los dos malos:
//
//   1. **la esbeltez se pierde justo donde se usa.** Reducir «un bloque es tinta
//      si alguna de sus celdas lo es» ENGORDA los trazos finos. Medido sobre la
//      máscara que de verdad se dibuja: la hebra pasa de razón 6,26 a 24 —donde
//      cumple— a 4,36 a escala 12 y **3,56 a escala 8**. La vara vale 4,00 a las
//      tres. O sea que a cinco y seis partes **la hebra sale MENOS esbelta que
//      la vara**, y la física la declara la más delgada de las seis;
//   2. **los tonos se colapsan.** A escala 8 la malla queda plana de un solo
//      tono: sombra y luz desaparecen y con ellas el volumen.
//
// Y lo peor no era ninguno de los dos, sino que **el invariante que tenía que
// cazarlo iba a dar verde**: comparaba los patrones de 24×24 contra
// `SLENDERNESS`, que es la única escala donde la hebra cumple — y la única que
// un cuerpo compuesto nunca usa.
//
// La salida es no reducir nada: **cada pieza se dibuja directo a la medida que
// le toca**. Un patrón no es una grilla guardada, es una función de `(ancho,
// alto, trama)`. Con eso la proporción sale bien a cualquier tamaño porque se
// calcula ahí, y los tres tonos se ponen donde tienen que ir en vez de
// sobrevivir a un promedio.
//
// ─── ARITMÉTICA ────────────────────────────────────────────────────────────
//
// Enteros y comparaciones. Nada de `Math.pow`, `sqrt`, `**`, azar ni reloj: lo
// prohíbe la regla 2 de `ii/` porque dos motores devuelven el último bit
// distinto, y un dibujo que dependa de eso deja de ser comparable entre
// clientes. `Math.trunc` y `Math.floor` sí están permitidos y son todo lo que
// hace falta.

import type { FormId } from '@anima/physics'

import type { Trama } from './paleta.js'

/**
 * UNA MÁSCARA: filas de índices de paleta. `0` transparente, `1` base, `2`
 * sombra, `3` luz.
 *
 * Nunca lleva colores, y ésa es la invariante que heredamos de Ánima I entera:
 * quien dibuja la forma elige VOLUMEN, jamás color. La coherencia de color no se
 * valida porque es imposible romperla.
 */
export type Mascara = readonly string[]

/**
 * CUÁN LARGA ES CADA FORMA POR UNIDAD DE ANCHO.
 *
 * Son los mismos números de `SLENDERNESS` en `@anima/physics` y están repetidos
 * acá a propósito, con este comentario al lado: la física los usa para calcular
 * el eje más largo de un ensamble —o sea el ALCANCE, que decide si se llega a
 * algo—, y el dibujo los usa para decidir la proporción. Si algún día divergen,
 * el que se arregla es éste. Hay un test que los compara fila por fila.
 */
const ESBELTEZ: Record<FormId, number> = {
  vara: 4,
  hebra: 6,
  filete: 1,
  malla: 1,
  bloque: 0.6,
  grano: 0.3,
}

/** Cuántas columnas de tinta le tocan a una pieza de `lado` celdas de alto. */
function anchoDe(forma: FormId, lado: number): number {
  const razon = ESBELTEZ[forma]
  if (razon <= 1) return lado
  const w = Math.trunc(lado / razon)
  // Nunca menos de una columna: una hebra de cero de ancho no es una hebra
  // delgada, es una hebra que no está.
  return w < 1 ? 1 : w
}

function fila(ancho: number, ch: string): string {
  let s = ''
  for (let i = 0; i < ancho; i++) s += ch
  return s
}

/**
 * EL VOLUMEN DE UN TRAZO: luz arriba, base en el medio, sombra abajo.
 *
 * Con dos columnas o menos no entra el degradé y queda base sola — es correcto y
 * no un caso especial: una hebra de una columna no tiene lados.
 */
function trazo(ancho: number, alto: number, trama: Trama): Mascara {
  // ─── UNA TIRA DE DOS CELDAS NO TIENE ADENTRO ────────────────────────────
  //
  // Es el mismo caso que la retícula: con ancho 1 o 2 toda celda toca el vacío,
  // así que no hay dónde poner luz y contornearla la dejaría de un solo tono —el
  // banco de la grilla lo cazó, porque exige al menos dos por forma—.
  //
  // La punta va en SOMBRA y no en luz: dos tonos, ninguno en el borde, y las dos
  // reglas cumplidas. Sale por acá y no pasa por `contornear`, que sobre esto no
  // tendría nada que hacer salvo aplastarlo.
  if (ancho <= 2) {
    const finas: string[] = []
    for (let y = 0; y < alto; y++) finas.push(fila(ancho, y === 0 ? '2' : '1'))
    return finas
  }

  const filas: string[] = []
  for (let y = 0; y < alto; y++) {
    // La VETA es el segundo eje de la trama y se ve acá: cuanto más tira una
    // sustancia, más seguido aparece la línea de fibra a lo largo del trazo.
    const cadaCuantas = trama.veta === 2 ? 2 : trama.veta === 1 ? 3 : 0
    const conFibra = cadaCuantas > 0 && y % cadaCuantas === 1
    let f = '1'
    // La luz se mueve UNA CELDA ADENTRO, que es lo que la regla dice — no se
    // borra. Sacarla del borde y no reponerla dejaba el trazo sin un solo `3`
    // cuando la veta es 0, y el banco de la grilla lo cazó al toque: su propiedad
    // de «volumen» mide justamente que un dibujo tenga los tres tonos.
    for (let x = 1; x < ancho - 1; x++) f += x === 1 || (conFibra && x % 2 === 0) ? '3' : '1'
    filas.push(f + '1')
  }
  // ─── Y ACÁ FALTABA EL CONTORNO, QUE ES LA DEUDA QUE EL JUEZ ANOTÓ ────────
  //
  // Esta función escribía un `3` —LUZ— en la columna 0 de cada fila, que es el
  // borde izquierdo del trazo y por lo tanto toca el vacío. Y la regla 3 de la
  // puerta de sprites dice, con todas las letras, que **un `3` nunca toca el
  // vacío**: el contorno va en sombra y la luz una celda adentro.
  //
  // O sea que el motor procedural violaba la regla que le exige a los dibujos del
  // modelo. Un sprite de vara escrito así lo rechaza la propia puerta, y el que
  // dibuja el motor entraba igual porque nadie se lo pregunta.
  //
  // El arreglo es una línea y no un parche: las dos columnas de los bordes pasan
  // a `1` y `contornear` hace lo suyo, que es exactamente para lo que existe. La
  // fibra interior sigue en `3` porque está adentro y no toca nada.
  return contornear(filas)
}

/**
 * UNA MASA COMPACTA, con las esquinas comidas según el GRANO.
 *
 * El grano es el primer eje de la trama y sale de `rigidity`: lo duro tiene
 * cantos vivos y lo blando se redondea. Es la diferencia que hace que una piedra
 * y un trozo de carne del mismo tamaño no se vean iguales aunque el color ya los
 * separe.
 */
function masa(ancho: number, alto: number, trama: Trama): Mascara {
  // ─── LA SILUETA DEL BLOQUE ES LA QUE MÁS TRABAJO TIENE QUE HACER ─────────
  //
  // Y el motivo es una medición: `formaDeLoSuelto` da `bloque` a 21 de las 30
  // sustancias, así que en un mapa real **casi todo es un bloque**. El primer
  // mapa de una partida lo mostró sin lugar a dudas: se veía una grilla de
  // cuadrados de colores, y el eje de la forma no estaba trabajando.
  //
  // La reparación no es agregar formas —eso sería cambiar la física— sino que
  // el GRANO cambie la silueta de verdad y no sólo un par de esquinas:
  //
  //   blando (rigidity < 0,22)  se desborda: muerde un tercio de cada esquina
  //                             y queda casi redondo, como algo que se aplasta;
  //   firme                     un canto de una celda;
  //   duro   (rigidity ≥ 0,65)  FACETA: un corte diagonal largo, como algo que
  //                             se quiebra en planos. Es lo que separa a la
  //                             piedra y al pedernal de un trozo de carne aun
  //                             cuando el color ya los separaba.
  const filas: string[] = []
  // Los tres escalones tienen que ser parejos, y el primer intento no lo era:
  // blando mordía un tercio y firme UNA celda, así que a 24 píxeles lo firme se
  // veía tan cuadrado como lo duro y el eje tenía dos valores en vez de tres.
  const muerde = trama.grano === 0 ? Math.max(2, Math.trunc(ancho / 3)) : trama.grano === 1 ? Math.max(1, Math.trunc(ancho / 6)) : 0
  const faceta = trama.grano === 2 ? Math.max(1, Math.trunc(ancho / 2)) : 0
  // La VETA marca la fibra: líneas de luz cruzando la masa, más seguidas cuanto
  // más tira la sustancia. Es lo que distingue la madera de la piedra de lejos.
  const cadaCuantas = trama.veta === 2 ? 3 : trama.veta === 1 ? 5 : 0

  for (let y = 0; y < alto; y++) {
    const deArriba = y
    const deAbajo = alto - 1 - y
    const borde = deArriba < muerde ? muerde - deArriba : deAbajo < muerde ? muerde - deAbajo : 0
    // El corte de la faceta se come la esquina de arriba a la derecha.
    const corte = faceta > 0 && y < faceta ? faceta - y : 0
    let f = ''
    for (let x = 0; x < ancho; x++) {
      if (x < borde || x >= ancho - borde || x >= ancho - corte) {
        f += '0'
        continue
      }
      if (y === 0) f += '3'
      else if (y === alto - 1) f += '2'
      else if (cadaCuantas > 0 && y % cadaCuantas === 1) f += '3'
      else f += x === ancho - 1 ? '2' : '1'
    }
    filas.push(f)
  }
  return contornear(filas)
}

/**
 * EL CONTORNO: toda celda de tinta que toca el vacío pasa a sombra.
 *
 * Es lo que más rinde a poco tamaño y el primer mapa lo pedía a gritos: a 24
 * píxeles vistos de lejos, dos manchas del mismo tono se funden y un borde
 * oscuro las separa. No inventa geometría —no agrega ni una celda de tinta, sólo
 * cambia el tono de las que ya estaban— así que la caja, la esbeltez y la cuenta
 * de tinta no se mueven.
 */
function contornear(m: readonly string[]): Mascara {
  const alto = m.length
  return m.map((fila, y) => {
    let out = ''
    for (let x = 0; x < fila.length; x++) {
      const ch = fila.charAt(x)
      if (ch === '0') {
        out += '0'
        continue
      }
      const vacio = (xx: number, yy: number): boolean => {
        if (yy < 0 || yy >= alto || xx < 0) return true
        const f = m[yy]
        if (f === undefined || xx >= f.length) return true
        return f.charAt(xx) === '0'
      }
      const borde = vacio(x - 1, y) || vacio(x + 1, y) || vacio(x, y - 1) || vacio(x, y + 1)
      out += borde ? '2' : ch
    }
    return out
  })
}

/** Una retícula: hilos cruzados con aire adentro. Es lo que se teje. */
function reticula(ancho: number, alto: number, trama: Trama): Mascara {
  const paso = trama.grano === 2 ? 2 : 3
  const filas: string[] = []
  for (let y = 0; y < alto; y++) {
    let f = ''
    for (let x = 0; x < ancho; x++) {
      const hilo = y % paso === 0 || x % paso === 0
      // ─── EL NUDO VA EN SOMBRA Y NO EN LUZ, Y LAS DOS REGLAS LO PIDEN ─────
      //
      // Estaba en `3` —luz— y en una retícula **toda celda toca el vacío**: es
      // hilo con aire alrededor, por definición. O sea que los nudos violaban la
      // regla 3, la misma que la puerta le exige a los sprites del modelo: un `3`
      // nunca toca el vacío.
      //
      // Lo primero que se probó fue pasarle `contornear` a la máscara entera, y
      // dejó la malla de UN SOLO TONO —todo toca el vacío, así que todo se vuelve
      // sombra— y ahí saltó el banco de la grilla, que exige al menos dos tonos
      // por forma: una silueta plana no se lee.
      //
      // Con el nudo en `2` las dos reglas se cumplen a la vez: hay dos tonos —
      // hilo en base, cruce en sombra— y ninguna luz en el borde. La regla 3
      // prohíbe el `3` tocando el vacío, no la sombra.
      f += hilo ? (y % paso === 0 && x % paso === 0 ? '2' : '1') : '0'
    }
    filas.push(f)
  }
  return filas
}

/** Materia suelta: puntos repartidos sin azar, por posición. */
function granos(ancho: number, alto: number, trama: Trama): Mascara {
  const denso = trama.grano === 0 ? 2 : 3
  const filas: string[] = []
  for (let y = 0; y < alto; y++) {
    let f = ''
    for (let x = 0; x < ancho; x++) {
      // Determinista y sin RNG: la posición decide. `(x*5 + y*3) % denso` reparte
      // sin alinear en filas ni columnas, que es lo que hace que parezca suelto.
      f += (x * 5 + y * 3) % denso === 0 ? (y % 2 === 0 ? '1' : '2') : '0'
    }
    filas.push(f)
  }
  return filas
}

/**
 * LA SILUETA DE UNA PIEZA, dibujada al tamaño que le toca. Total: las seis
 * formas están cubiertas y `Record<FormId, …>` obliga a que sigan estándolo.
 *
 * `lado` es la caja cuadrada disponible. Lo que la pieza ocupe adentro lo decide
 * su esbeltez, que es lo que hace que una vara y un bloque del mismo tamaño de
 * caja se vean distintos sin que nadie escriba «una vara es flaca».
 */
export function siluetaDe(forma: FormId, lado: number, trama: Trama): Mascara {
  const ancho = anchoDe(forma, lado)
  switch (forma) {
    case 'vara':
    case 'hebra':
      return trazo(ancho, lado, trama)
    case 'filete':
      // Chata: ocupa el ancho entero y la mitad del alto.
      return masa(lado, Math.max(1, Math.trunc(lado / 2)), trama)
    case 'malla':
      return reticula(lado, lado, trama)
    case 'grano':
      return granos(lado, lado, trama)
    case 'bloque':
      return masa(lado, lado, trama)
  }
}

/** Las mismas seis, para que un test pueda barrerlas sin escribirlas de nuevo. */
export const FORMAS: readonly FormId[] = ['vara', 'hebra', 'filete', 'malla', 'bloque', 'grano']

/** Se exporta sólo para el test que la compara contra la física. */
export const ESBELTEZ_DEL_DIBUJO = ESBELTEZ
