// ─── EL ENCARGO DE UN DIBUJO ────────────────────────────────────────────────
//
// Acá se arma QUÉ pedirle al modelo y se recibe lo que conteste. **El viaje no
// está acá**, y no es una omisión: es el ADR II-0024 —*el paquete de adentro
// describe, el de afuera espera*—, el mismo reparto que usa la fragua, que
// tampoco llama al proveedor. Con eso, todo lo de este archivo se prueba sin red
// y sin una sola promesa.
//
// ─── LA VERSIÓN 1 DE ESTE ARCHIVO FALLÓ, Y VALE SABER POR QUÉ ──────────────
//
// El usuario miró el mapa y dijo dos cosas: que los sprites no se entiende qué
// son, que una rama parecía «un pedazo de mierda literal», y que la criatura
// «parece una roca». Las tres tenían la misma causa y ninguna era del modelo.
//
//   1. **SE PEDÍA UN MATERIAL, NO UNA COSA.** El encargo decía «una pieza de
//      madera en forma de vara, cuatro veces más larga que ancha» y el modelo
//      dibujaba exactamente eso: una barra de cinco filas sobre veinticuatro. Y
//      está bien dibujada — el problema es que «un pedazo de madera» **no
//      restringe ninguna silueta**, y a 24 píxeles la silueta es casi todo el
//      reconocimiento. «Una rama seca» sí: es larga, torcida, se rompió de una
//      punta;
//   2. **NO SE DECÍA CUÁNTO LIENZO USAR.** Nadie dibuja una rama ocupando el
//      17% del cuadro. Una PIEZA sí, porque una pieza es el recorte de algo más
//      grande y un recorte no tiene tamaño natural;
//   3. **LA CRIATURA RECIBÍA EL PEOR PROMPT DE LOS 540.** `partirClave` le daba
//      `forma: 'criatura'`, la tabla de formas no la tenía, y el prompt salía
//      con «la forma "criatura" es una pieza suelta». Eso explica la roca mejor
//      que cualquier teoría sobre la clave.
//
// ─── Y LOS NÚMEROS SE FUERON, PERO NO LA SEÑAL ─────────────────────────────
//
// El encargo viejo mandaba `rigidez 0.70` y le pedía al modelo que decidiera la
// textura con eso. Una escala abstracta sin referente visual obliga a inventar
// un mapeo, y el prompt lo empujaba hacia la textura — que a 24 píxeles es
// ruido, y el ruido es literalmente lo que arruinó la rama.
//
// Pero sacarlos del todo deja ciega a toda sustancia que el oráculo invente en
// runtime, que es la que más lo necesita. Así que **se traducen acá**, con
// umbrales explícitos, y al modelo le llegan palabras que se pueden dibujar.

import type { FormId, Physics, Substance } from '@anima/physics'

import { claveDePieza, esDeCriatura, revisarSprite, type ClaveDeSprite, type Sprites, type Veredicto } from './sprite.js'

/** Lo que hay que saber para pedir un dibujo, sacado de la clave. */
export interface Encargo {
  readonly clave: ClaveDeSprite
  readonly lado: number
  readonly prompt: string
}

/** Parte una clave en sus tres pedazos. `undefined` si no es una clave. */
export function partirClave(clave: ClaveDeSprite): { forma: string; sustancia: string; lado: number } | undefined {
  const p = clave.split('/')
  if (p.length !== 3) return undefined
  const [forma, sustancia, lado] = p
  if (forma === undefined || sustancia === undefined || lado === undefined) return undefined
  const n = Number.parseInt(lado, 10)
  if (!Number.isInteger(n) || n < 4 || n > 64) return undefined
  return { forma, sustancia, lado: n }
}

// ─── El oficio: la parte del prompt que NO cambia ───────────────────────────
//
// Va PRIMERO y lo variable va último, y no es cuestión de prolijidad: así el
// prefijo es el mismo para las 540 claves y se puede cachear entero, mientras
// que la instrucción específica queda pegada a la respuesta, que es donde más se
// obedece.
//
// Las reglas de luz de acá NO son gusto: son las que el motor ya ejecuta en
// `forma.ts`. `contornear()` manda a sombra toda celda de tinta que toca el
// vacío —incluida la de arriba, que `masa` había puesto en luz—, así que un
// sprite con el borde superior iluminado convive mal con las 21 sustancias que
// se dibujan procedurales. De ahí sale la regla que más cambia el resultado:
// **un 3 nunca toca el vacío**.

const EL_OFICIO = `Sos pixel artist. Vas a dibujar UNA COSA, en píxeles, en una grilla cuadrada.
Todavía no te digo cuál: primero el oficio, que es igual para todas.

── LOS CUATRO CARACTERES ────────────────────────────────────────────────
  0  vacío: se ve el suelo del mapa
  1  el color base
  2  la sombra
  3  la luz
No elegís colores. El color lo pone el motor según la materia; vos elegís
el VOLUMEN. Por eso el peor dibujo posible sigue siendo del color correcto.

── LA LUZ VIENE DE ARRIBA A LA IZQUIERDA. SIEMPRE ───────────────────────
En todas las piezas del juego, sin excepción: si cada una se ilumina de su
lado, el mapa se ve como un collage de recortes. Se arma en tres pasos y en
este orden:

  a) dibujá la silueta entera llena de 1;
  b) pasá a 2 TODA celda de tinta que toque el vacío. Todo el contorno,
     también el de arriba. El contorno oscuro es lo único que despega la
     pieza del suelo cuando el suelo es del mismo tono;
  c) poné 3 en la primera celda de adentro del contorno, y SÓLO del lado de
     arriba y del lado izquierdo.

De ahí sale la regla que más cambia el resultado:

     UN 3 NUNCA TOCA EL VACÍO.

Y tres más:
  · el 2 y el 3 van en TIRAS que siguen un borde, nunca sueltos ni
    salpicados. Un 3 en el medio de los 1 es suciedad, no brillo;
  · si la pieza es tan delgada que casi todo es contorno, el contorno gana:
    no inventes luz para llenar. Una parte delgada puede ser toda 2;
  · un trazo largo se dibuja de 4 o 5 celdas de ancho, para que entren los
    cuatro tonos a lo ancho: 2 / 3 / 1 / 2. Con 3 celdas no hay volumen.

── LA SILUETA TIENE QUE FUNCIONAR EN NEGRO ──────────────────────────────
Tapá los tonos y mirá el bulto. Si lo que queda es un rectángulo, un óvalo
o una barra, no se va a entender qué es. Entonces:
  · UNA SOLA PIEZA CONECTADA. Ni una celda flotando suelta;
  · nada simétrico de espejo en los dos ejes a la vez: lo simétrico se lee
    como ícono, no como cosa;
  · al menos un accidente que diga qué es: un muñón donde se rompió una
    rama, una punta astillada, un canto saltado, una curva, un nudo;
  · nada de rectángulos ni de barras. Cuatro lados rectos en ángulo recto
    es una caja, y en este mundo nada tiene lados rectos salvo lo que
    alguien talló;
  · nada de detalles de una sola celda: a esta escala una celda suelta es
    ruido;
  · nada de suelo, ni fondo, ni sombra proyectada. Dibujás la cosa
    recortada y nada más: el 0 deja ver la celda del mapa.

── LO LARGO VA EN DIAGONAL ⟋ ────────────────────────────────────────────
De abajo-izquierda a arriba-derecha, para toda pieza más del doble de larga
que de ancha. Tres motivos:
  · entra 40% más grande: la diagonal del cuadro es más larga que el lado;
  · una barra horizontal o vertical se lee como un renglón o un ladrillo;
    una diagonal se lee como una cosa TIRADA EN EL SUELO, y el suelo es
    donde va esto;
  · la escalera de píxeles de una diagonal ya es un borde irregular, y lo
    natural no tiene bordes perfectos.
Lo compacto no va en diagonal: va APOYADO, con la base más ancha que la
cima, mostrando la cara que mira al cielo.

── DOS DIBUJOS DE REFERENCIA ────────────────────────────────────────────
Son de 24×24 y son de OTRAS cosas. No los copies: mirá dónde está la tinta,
dónde está cada tono, y cuánto del cuadro ocupan.

A · una rama de madera. Diagonal ⟋ con un muñón a un tercio, el extremo
roto abajo y la punta arriba.
000000000000000000000000
000000000000000000000000
000000000000000000000000
000000000000000000022200
000000000000000002232000
000000022000000223332000
000000022000002333120000
000000002200023311120000
000000002200233111120000
000000000222331111200000
000000000233311112000000
000000000231111120000000
000000002331111200000000
000000223311112000000000
000002333111120000000000
000023311111200000000000
000233111112000000000000
002331111120000000000000
023311111120000000000000
023111111200000000000000
002311112000000000000000
000231120000000000000000
000023200000000000000000
000002000000000000000000

B · un canto de piedra. Masa apoyada, base ancha, silueta asimétrica, con
una arista recta cruzando el frente porque la piedra se quiebra en planos.
000000000000000000000000
000000000000000000000000
000000000000000000000000
000000222222220000000000
000002333333112220000000
000023333331111112200000
000233333311111111122000
002333331111111111111200
002333311111111111111200
023333111111111111121120
023311111111111112111120
023111111111111121111120
021111111111111211111120
021111111111121111111120
021111111111211111111220
021111111112111111122200
021111111211111111222200
002111112111111112222200
002111111111111222222000
000211111111112222222000
000021111111122222220000
000002211112222222200000
000000022222222200000000
000000000000000000000000
`

// ─── De las cualidades a palabras que se puedan dibujar ─────────────────────

const RIGIDO = 0.65
const BLANDO = 0.22
const SE_CURVA = 0.55
const FIBROSO = 0.65
const HUMEDO = 0.5

function q(s: Substance, k: string): number {
  const v = (s.perUnitMass as Record<string, number | undefined>)[k]
  return v === undefined ? 0 : v
}

/** Dos o tres rasgos de materia, nunca un número. */
function materiaDe(s: Substance): string {
  const dice: string[] = []
  if (q(s, 'rigidity') >= RIGIDO) dice.push('se quiebra en planos y tiene cantos rectos')
  else if (q(s, 'rigidity') < BLANDO) dice.push('es blanda: se abolla y no tiene una sola arista')
  if (q(s, 'flexibility') >= SE_CURVA) dice.push('se curva antes de romperse')
  if (q(s, 'tensile') >= FIBROSO) dice.push('tira a lo largo: se le ve la fibra')
  if (q(s, 'moisture') >= HUMEDO) dice.push('está húmeda: el borde brilla')
  if (q(s, 'sharpness') > 0) dice.push('termina en filo, afinada hasta una celda')

  const nombre = s.lexeme.nombre
  const otros = s.lexeme.sinonimos.length > 0 ? ` (${s.lexeme.sinonimos.join(', ')})` : ''
  const cabeza = `Es ${nombre}${otros}.`
  // Tres como mucho: una lista larga de adjetivos se lee como ruido y el modelo
  // termina intentando dibujarlos todos en 24 píxeles.
  return dice.length === 0 ? cabeza : `${cabeza} ${dice.slice(0, 3).join('; ')}.`
}

// ─── Qué cosa es, y cómo entra en el cuadro ─────────────────────────────────
//
// ─── POR QUÉ ESTO SE COMPONE Y NO ES UNA TABLA DE TREINTA FILAS ────────────
//
// Una tabla `(sustancia × forma) → nombre` escrita a mano sería un catálogo de
// tipos por la puerta de atrás, y en el peor lugar posible: la capa de dibujo,
// que es la que nadie cruza contra la física. Lo que hace tóxico a un tipo no es
// entrar en un hash — es ser **una lista privilegiada que alguien tiene que ir
// extendiendo**. El oráculo inventa sustancias en runtime; el día que invente
// una, la salida más probable no sería mejorar el fallback, sería agregar la
// fila.
//
// Acá el fallback ES el camino normal: se compone de la forma y del `lexeme`,
// que es donde los nombres humanos ya viven y que la física ya ignora. Si se
// degrada, se nota enseguida, porque es lo que corre casi siempre.

interface Cosa {
  readonly cosa: string
  readonly encuadre: string
  readonly rasgos: readonly string[]
}

const RASGOS_DE_LA_CRIATURA: readonly string[] = [
  'cabeza redonda, separada del torso por un cuello de dos celdas',
  'dos brazos que cuelgan a los costados, con AIRE de verdad (0) entre el brazo y el cuerpo',
  'dos piernas con un hueco (0) entre ellas y los pies apoyados en la última fila',
  'dos ojos: dos celdas de 2 en la cara, con base entre ellas',
  'un bulto con patas pintadas encima sigue siendo un bulto. Los huecos tienen que ser 0',
]

const RASGOS_DE_LO_SUELTO: readonly string[] = [
  'el contorno irregular y asimétrico',
  'ni un lado recto ni dos lados iguales',
  'una punta rota, o un canto saltado',
]

function cosaDe(forma: string, nombre: string): Cosa {
  switch (forma) {
    case 'criatura':
      return {
        cosa: 'una criatura viva, de pie, de frente, de cuerpo entero',
        encuadre: 'De pie, apoyada en la última fila y tocando o casi tocando la primera.',
        rasgos: RASGOS_DE_LA_CRIATURA,
      }
    case 'vara':
      return {
        cosa: `un palo de ${nombre}`,
        encuadre: 'Cruza el cuadro en diagonal ⟋, de una esquina a la otra. Toca la primera fila y la última.',
        rasgos: RASGOS_DE_LO_SUELTO,
      }
    case 'hebra':
      return {
        cosa: `una tira larga de ${nombre}, que cuelga`,
        encuadre: 'Cruza el cuadro en diagonal ⟋, curvándose, de una esquina a la otra.',
        rasgos: RASGOS_DE_LO_SUELTO,
      }
    case 'filete':
      return {
        cosa: `una lámina de ${nombre}`,
        encuadre: 'Apoyada abajo, ancha, con una esquina levantada.',
        rasgos: RASGOS_DE_LO_SUELTO,
      }
    case 'malla':
      return {
        cosa: `un tejido de ${nombre}`,
        encuadre: 'Llena el cuadro entero; entre los hilos se ve el suelo.',
        rasgos: RASGOS_DE_LO_SUELTO,
      }
    case 'grano':
      return {
        cosa: `un puñado de ${nombre}`,
        encuadre:
          'Un montículo de base ancha y cima irregular, con cinco o seis granos sueltos alrededor de la base.',
        rasgos: RASGOS_DE_LO_SUELTO,
      }
    default:
      return {
        cosa: `un pedazo suelto de ${nombre}, del tamaño de un puño`,
        encuadre: 'Apoyado abajo, base más ancha que la cima.',
        rasgos: RASGOS_DE_LO_SUELTO,
      }
  }
}

/**
 * CUÁNTO DEL CUADRO TIENE QUE OCUPAR, por familia de forma.
 *
 * Es la respuesta al defecto 2: la barra de cinco filas sobre veinticuatro pasó
 * la puerta vieja sin problema. Un mínimo explícito es lo que convierte «que
 * ocupe buena parte» en algo que se puede exigir y verificar.
 */
export function encuadreMinimo(forma: string, lado: number): { filas: number; columnas: number } {
  const casiTodo = Math.ceil((lado * 5) / 6)
  const chato = Math.ceil((lado * 7) / 12)
  if (forma === 'filete') return { filas: chato, columnas: lado - 2 }
  if (forma === 'grano') return { filas: chato, columnas: casiTodo }
  return { filas: casiTodo, columnas: casiTodo }
}

/**
 * EL ENCARGO DE UNA CLAVE. `undefined` si la clave no se entiende o la sustancia
 * no existe: no se le pide al modelo que dibuje algo que el mundo no tiene.
 */
export function encargoDe(clave: ClaveDeSprite, phys: Physics): Encargo | undefined {
  const p = partirClave(clave)
  if (p === undefined) return undefined
  const s = phys.substances.get(p.sustancia)
  if (s === undefined) return undefined

  const forma = esDeCriatura(clave) ? 'criatura' : p.forma
  const { cosa, encuadre, rasgos } = cosaDe(forma, s.lexeme.nombre)
  const min = encuadreMinimo(forma, p.lado)

  // A menos de 24 no entra ningún detalle de una celda, y los dos dibujos de
  // referencia son de 24: hay que decirlo o el modelo intenta miniaturizarlos.
  const escala =
    p.lado === 24
      ? ''
      : `\nOJO: los dos dibujos de referencia son de 24×24 y vos dibujás a ${String(p.lado)}×${String(p.lado)}.\n` +
        'A este tamaño no entra ningún detalle de una celda: tirá los accidentes y\n' +
        'quedate con la silueta, el contorno entero en 2 y una celda de luz\n' +
        'arriba-izquierda.\n'

  const prompt = `${EL_OFICIO}
════════════════════════════════════════════════════════════════════════
AHORA SÍ, LO QUE TENÉS QUE DIBUJAR:

    ${cosa}

El único criterio es éste: alguien que mire el dibujo un segundo, sin leer
nada, tiene que poder decir «${cosa}». Todo lo de arriba está para eso.

DE QUÉ ESTÁ HECHA
${materiaDe(s)}

QUÉ HAY QUE DIBUJAR PARA QUE SE RECONOZCA
${rasgos.map((r) => `  · ${r}`).join('\n')}

CÓMO ENTRA EN EL CUADRO
${encuadre}
La cosa tiene que tocar al menos ${String(min.filas)} de las ${String(p.lado)} filas y al menos
${String(min.columnas)} de las ${String(p.lado)} columnas. A esta escala el objeto ES el cuadro:
una figura chica en el medio, rodeada de vacío, no se lee como una cosa —
se lee como una mota.
${escala}
ANTES DE CONTESTAR, contá:
  ¿son ${String(p.lado)} líneas?
  ¿todas de ${String(p.lado)} caracteres?
  ¿toca ${String(min.filas)} filas y ${String(min.columnas)} columnas?
  ¿hay algún 3 tocando un 0? Si lo hay, pasalo a 2.
  ¿quedó alguna celda de tinta separada del resto? Si quedó, pegala o sacala.

FORMATO: exactamente ${String(p.lado)} líneas de ${String(p.lado)} caracteres, sólo 0 1 2 3.
Respondé SOLO las líneas, sin explicación ni bloque de código.`

  return { clave, lado: p.lado, prompt }
}

/** Los encargos de todo lo que falta, en el orden en que se pidió. */
export function loQueHayQuePedir(sprites: Sprites, phys: Physics): readonly Encargo[] {
  const out: Encargo[] = []
  for (const clave of sprites.loQueFalta()) {
    const e = encargoDe(clave, phys)
    if (e !== undefined) out.push(e)
  }
  return out
}

/**
 * LO QUE CONTESTÓ EL MODELO, convertido en sprite o rechazado.
 *
 * Tolera lo que todo modelo hace igual —cercas de código, texto antes y después,
 * líneas en blanco— y **no tolera nada más**. Limpiar de más sería empezar a
 * adivinar qué quiso decir, y lo que no se entiende se rechaza: el costo de
 * rechazar es dibujar procedural una vuelta más, que ya sabemos que se ve bien.
 */
export function recibir(sprites: Sprites, clave: ClaveDeSprite, lado: number, texto: string): Veredicto {
  return sprites.guardar(clave, lado, { filas: filasDe(texto) })
}

/** Las líneas del alfabeto y nada más. `\r` normalizado ANTES de partir. */
function filasDe(texto: string): string[] {
  return texto
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[0-3]+$/.test(l))
}

/** El mismo camino, para el que ya tiene la clave y el texto y nada más. */
export function revisarRespuesta(clave: ClaveDeSprite, texto: string): Veredicto {
  const p = partirClave(clave)
  if (p === undefined) return { ok: false, porque: 'la clave no se entiende' }
  return revisarSprite({ filas: filasDe(texto) }, clave, p.lado)
}

/** Para el que tiene la forma y la sustancia sueltas. */
export function encargoDePieza(forma: string, sustancia: string, lado: number, phys: Physics): Encargo | undefined {
  return encargoDe(claveDePieza(forma as FormId, sustancia, lado), phys)
}
