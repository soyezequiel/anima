// ─── EL SPRITE: lo que dibuja el modelo, sobre lo que ya dibuja el motor ────
//
// La idea es la de Ánima I —«la quinta puerta»: el modelo propone un dibujo y
// una puerta determinista decide si entra— adaptada a un mundo que no tiene
// nombres de cosas. Y hay tres cambios de fondo que conviene leer antes que el
// código, porque los tres salen de mediciones de este proyecto.
//
// ─── 1 · LA CLAVE NO PUEDE SER «LA COSA», PORQUE ACÁ NO HAY COSAS ──────────
//
// En Ánima I el sprite se cachea por `kind`: un nombre que la IA Dios inventó.
// Ánima II no tiene `kind` —un cuerpo es forma, partes y juntas, y todo lo demás
// se calcula—, así que la identidad visual hay que construirla.
//
// Y hay que construirla **sin el estado**. Si la clave incluyera `estado` o
// `porte`, cada grado de temperatura sería un sprite nuevo: el caché no
// serviría de nada y el modelo dibujaría el mismo leño cien veces. Lo que
// identifica visualmente a una PIEZA son dos cosas y nada más:
//
//     forma × sustancia × la medida a la que se dibuja
//
// Son 6 × 30 × 3 = 540 claves posibles como techo, y en una partida real se
// tocan unas pocas decenas. Eso es lo que hace que un caché compartido entre
// todas las partidas de todo el mundo tenga sentido: **el mismo sprite de
// `vara de madera` sirve en la partida de cualquiera**.
//
// ─── 2 · POR QUÉ PIEZAS Y NO OBJETOS ENTEROS (en esta fase) ────────────────
//
// Porque un sprite de objeto entero **tapa la estructura**, y la estructura es
// lo que costó arreglar: con un dibujo fijo por objeto, cinco piezas y seis
// vuelven a verse igual. Dibujando piezas, el motor sigue componiendo y la
// cuenta se conserva. Los objetos enteros son la fase 3 y van sólo para las
// claves que se midan frecuentes, con el procedural debajo.
//
// ─── 3 · LA MEDIDA ENTRA EN LA CLAVE, Y NO ES UN DETALLE ───────────────────
//
// Un sprite de 24×24 reducido a 8×8 se rompe, y no es una opinión: está medido
// en el encabezado de `forma.ts` —la regla «es tinta si alguna celda lo es»
// engorda los trazos finos y la hebra termina MENOS esbelta que la vara—. Por
// eso acá no se reduce nunca: **si no hay sprite para esa medida, se dibuja
// procedural**, y listo. Un objeto de seis piezas usa piezas de lado 8; si el
// modelo todavía no dibujó ninguna de lado 8, ese objeto se ve procedural y no
// se ve mal.
//
// ─── Y LO QUE NO CAMBIA NUNCA ──────────────────────────────────────────────
//
// **Un sprite no entra en ningún hash.** Ni en `renderDescriptorHash`, ni en
// `worldHash`, ni en `escenaHash`. Dos clientes, uno con sprites y otro sin
// ellos, tienen que coincidir en los tres — y hay un test que lo afirma. Es la
// regla del ADR II-0017 y es lo que permite que esto sea opcional de verdad.

import type { FormId, SubstanceId } from '@anima/physics'

import type { Mascara } from './forma.js'

/** La grilla nativa. Es la que eligió el banco de `la-medida-de-la-grilla`. */
export const LADO_NATIVO = 24

/** Las tres medidas a las que el motor dibuja una pieza: 1, 2-4 y 5-6 partes. */
export const MEDIDAS_QUE_SE_USAN: readonly number[] = [24, 12, 8]

/**
 * CUÁNTA TINTA HACE UN DIBUJO. Menos que esto es una mota: técnicamente válida,
 * invisible en pantalla. Heredado de Ánima I, escalado a la grilla de acá.
 */
const TINTA_MINIMA = 12

/** La clave de un sprite. Texto plano para que viaje por JSON y por una URL. */
export type ClaveDeSprite = string

/**
 * LA CLAVE DE UNA PIEZA. Sin estado, sin porte, sin posición: sólo lo que
 * decide cómo se ve una pieza suelta.
 */
export function claveDePieza(forma: FormId, sustancia: SubstanceId, lado: number): ClaveDeSprite {
  return `${forma}/${sustancia}/${String(lado)}`
}

/**
 * LA CLAVE DE UNA CRIATURA — y por qué no es un tipo de objeto por la ventana.
 *
 * El problema, dicho por el usuario: **la criatura parece una roca**. Y tenía
 * que parecerlo: su cuerpo es `carne`, una parte, forma `bloque`, así que pedía
 * exactamente la misma clave que un trozo de carne tirado en el piso.
 *
 * ─── POR QUÉ ESTO NO ROMPE «EL MUNDO NO TIENE TIPOS» ───────────────────────
 *
 * Porque no lo inventa el dibujo: **ser un agente es estado del mundo**. La
 * escena publica `ActorEnEscena.body`, o sea que «este cuerpo es de alguien que
 * actúa» es un hecho que el mundo ya sabe y ya guarda. Pedir un dibujo distinto
 * para eso es publicar algo que existe, no fabricar una categoría.
 *
 * La prueba de que la distinción es del mundo y no nuestra: si mañana el juego
 * tuviera dos criaturas, las dos entrarían acá sin escribir una línea; si
 * tuviera un tipo `personaje`, habría que darlo de alta en algún lado.
 *
 * La sustancia queda en la clave porque una criatura de carne y una de otra
 * materia son criaturas distintas, y el mundo permite las dos.
 */
export function claveDeCriatura(sustancia: SubstanceId, lado: number): ClaveDeSprite {
  return `criatura/${sustancia}/${String(lado)}`
}

/** ¿Esta clave es la de una criatura? Lo usa el encargo para cambiar de prompt. */
export function esDeCriatura(clave: ClaveDeSprite): boolean {
  return clave.startsWith('criatura/')
}

export interface Sprite {
  readonly clave: ClaveDeSprite
  readonly lado: number
  /** `lado` filas de `lado` caracteres, cada uno un índice de paleta `0-3`. */
  readonly filas: readonly string[]
}

export type Veredicto = { ok: true; sprite: Sprite } | { ok: false; porque: string }

/**
 * LA PUERTA. Lo que propone un modelo es tan poco confiable como cualquier dato
 * externo, y acá **no se juzga si el dibujo se parece a la cosa** —eso no lo
 * puede decidir ninguna regla determinista— sino si es DIBUJABLE.
 *
 * Es corta por una razón que vale la pena copiar de Ánima I entera:
 *
 * > Un dibujo que llegara como colores libres habría que revisarlo contra la
 * > paleta, contra el fondo, contra el contraste; como llega como índices, el
 * > peor glifo posible sigue siendo del color que le corresponde a su material.
 * > La coherencia no se valida: es imposible romperla.
 *
 * Por eso un sprite feo es un problema estético y **nunca** un problema de
 * coherencia: no puede pintar una piedra de rosa aunque quiera.
 *
 * Corre en las DOS puntas —el cliente antes de mandar, el backend antes de
 * guardar— con la misma función, que es como Ánima I evita que las dos puertas
 * apliquen reglas distintas.
 */
export function revisarSprite(raw: unknown, clave: ClaveDeSprite, lado: number): Veredicto {
  if (typeof raw !== 'object' || raw === null) return { ok: false, porque: 'no es un objeto' }
  const filas = (raw as { filas?: unknown }).filas
  if (!Array.isArray(filas)) return { ok: false, porque: 'no trae `filas`' }
  if (filas.length !== lado) {
    return { ok: false, porque: `son ${String(filas.length)} filas y tienen que ser ${String(lado)}` }
  }

  let tinta = 0
  for (let y = 0; y < filas.length; y++) {
    const f: unknown = filas[y]
    if (typeof f !== 'string') return { ok: false, porque: `la fila ${String(y)} no es texto` }
    if (f.length !== lado) {
      return { ok: false, porque: `la fila ${String(y)} mide ${String(f.length)} y tiene que medir ${String(lado)}` }
    }
    for (const ch of f) {
      if (ch < '0' || ch > '3') {
        return { ok: false, porque: `«${ch}» no es un índice de paleta: sólo 0 vacío, 1 base, 2 sombra, 3 luz` }
      }
      if (ch !== '0') tinta++
    }
  }
  if (tinta < TINTA_MINIMA) {
    return { ok: false, porque: `${String(tinta)} celdas encendidas: menos de ${String(TINTA_MINIMA)} es una mota` }
  }

  const dibujo = filas as string[]
  const mal = loQueNoSeVaAEntender(dibujo, clave, lado, tinta)
  if (mal !== undefined) return { ok: false, porque: mal }

  return { ok: true, sprite: { clave, lado, filas: [...dibujo] } }
}

// ─── LAS CUATRO REGLAS QUE FALTABAN, Y CÓMO SE LLEGÓ A ELLAS ────────────────
//
// La puerta original validaba medida, alfabeto y doce celdas encendidas. Con
// eso, **la barra de cinco filas sobre veinticuatro que el usuario llamó «un
// pedazo de mierda literal» pasó sin objeción**. Un prompt que exige ocupar
// 20×20 y una puerta que se conforma con 12 celdas es cómo se llega ahí: la
// exigencia estaba escrita donde no se verifica.
//
// Las cuatro son deterministas, baratas, y cada una caza un defecto que se vio
// de verdad — tres en lo que devolvió Codex y uno en los ejemplos que se
// escribieron para enseñarle. **El costo de rechazar es una vuelta de
// procedural**, que ya sabemos que se ve bien; el costo de aceptar es un dibujo
// feo que se le reparte a todos los jugadores para siempre, porque primero gana.

/**
 * CUÁNTA SOMBRA DE MÁS se le permite a un dibujo, sobre su propio contorno.
 *
 * ─── LA PRIMERA VERSIÓN ERA UN UMBRAL FIJO, Y ERA EL PARCHE EQUIVOCADO ─────
 *
 * Decía «no más del 50% de la tinta», y rechazó dos dibujos correctos: la
 * criatura por 52% y la liana por 54%. La reparación tentadora —y la que se
 * escribió primero— fue subirle el techo a las formas delgadas: `criatura` y
 * `hebra` al 62%. Duró un lote: **`vara/liana` falló igual**, porque una liana
 * es tan fina como una hebra y la lista no la tenía.
 *
 * Una lista de formas privilegiadas siempre le va a faltar la siguiente. Lo que
 * la lista estaba tratando de aproximar es una propiedad del DIBUJO, no de su
 * clase:
 *
 *     una pieza fina tiene mucho perímetro por unidad de área.
 *
 * Y el perímetro **tiene que ser sombra**: lo exige la regla 3 de esta misma
 * puerta. Así que en una pieza fina, «casi toda la tinta es sombra» no es un
 * defecto: es la consecuencia aritmética de las otras reglas.
 *
 * De ahí sale la regla buena, que no mira la forma sino el dibujo: **la sombra
 * no puede pasarse mucho de su propio contorno**. Lo que caza sigue siendo lo
 * mismo —el canto rodado con una mitad de un color y otra de otro, cuyo contorno
 * es el 20% y cuya sombra es el 50%— y ahora se lo caza por lo que es.
 */
const SOMBRA_DE_MAS = 0.18

interface Caja {
  readonly filas: number
  readonly columnas: number
}

function cajaDe(filas: readonly string[]): Caja {
  let y0 = 1e9
  let y1 = -1
  let x0 = 1e9
  let x1 = -1
  for (let y = 0; y < filas.length; y++) {
    const f = filas[y]
    if (f === undefined) continue
    for (let x = 0; x < f.length; x++) {
      if (f.charAt(x) === '0') continue
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      if (x < x0) x0 = x
      if (x > x1) x1 = x
    }
  }
  return y1 < 0 ? { filas: 0, columnas: 0 } : { filas: y1 - y0 + 1, columnas: x1 - x0 + 1 }
}

/** Cuántas islas de tinta hay. Una cosa es una; dos es una cosa con basura al lado. */
function islas(filas: readonly string[]): number {
  const alto = filas.length
  const visto = filas.map((f) => new Array<boolean>(f.length).fill(false))
  let cuantas = 0
  for (let y = 0; y < alto; y++) {
    const fila = filas[y]
    if (fila === undefined) continue
    for (let x = 0; x < fila.length; x++) {
      if (fila.charAt(x) === '0' || visto[y]?.[x] === true) continue
      cuantas++
      // Inundación iterativa y no recursiva: 24×24 no desborda la pila, pero
      // esto también corre sobre lo que mande un desconocido.
      const pila: [number, number][] = [[y, x]]
      while (pila.length > 0) {
        const donde = pila.pop()
        if (donde === undefined) continue
        const [cy, cx] = donde
        const f = filas[cy]
        if (f === undefined || cx < 0 || cx >= f.length || f.charAt(cx) === '0') continue
        const marca = visto[cy]
        if (marca === undefined || marca[cx] === true) continue
        marca[cx] = true
        pila.push([cy + 1, cx], [cy - 1, cx], [cy, cx + 1], [cy, cx - 1])
      }
    }
  }
  return cuantas
}

function tocaElVacio(filas: readonly string[], y: number, x: number): boolean {
  for (const [dy, dx] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const) {
    const f = filas[y + dy]
    if (f === undefined || x + dx < 0 || x + dx >= f.length) return true
    if (f.charAt(x + dx) === '0') return true
  }
  return false
}

/**
 * Lo que hace que un dibujo válido igual no se entienda. `undefined` si pasa.
 *
 * La forma sale de la clave porque las exigencias no son iguales para todas: un
 * puñado de granos son islas por definición, y un tejido tiene agujeros.
 */
function loQueNoSeVaAEntender(
  filas: readonly string[],
  clave: ClaveDeSprite,
  lado: number,
  tinta: number,
): string | undefined {
  const forma = clave.split('/')[0] ?? ''

  // 1 · OCUPAR EL CUADRO. El defecto que motivó todo esto.
  const caja = cajaDe(filas)
  const minimo = forma === 'filete' || forma === 'grano' ? Math.ceil((lado * 7) / 12) : Math.ceil((lado * 5) / 6)
  if (caja.filas < minimo || caja.columnas < minimo) {
    return (
      `ocupa ${String(caja.filas)}×${String(caja.columnas)} de ${String(lado)}×${String(lado)}: ` +
      `a esta escala una figura chica rodeada de vacío no se lee como una cosa, se lee como una mota ` +
      `(hacen falta ${String(minimo)} filas y ${String(minimo)} columnas)`
    )
  }

  // 2 · UNA SOLA PIEZA. Salvo lo que por definición está suelto.
  if (forma !== 'grano' && forma !== 'malla') {
    const cuantas = islas(filas)
    if (cuantas > 1) {
      return `son ${String(cuantas)} pedazos separados y tiene que ser uno solo: lo que flota suelto se lee como suciedad`
    }
  }

  // 3 · UN 3 NUNCA TOCA EL VACÍO. Es la regla que el motor ya ejecuta en
  //     `contornear()`, y sin ella un sprite convive iluminado al revés que las
  //     21 sustancias que se dibujan procedurales.
  let luzAfuera = 0
  for (let y = 0; y < filas.length; y++) {
    const f = filas[y]
    if (f === undefined) continue
    for (let x = 0; x < f.length; x++) {
      if (f.charAt(x) === '3' && tocaElVacio(filas, y, x)) luzAfuera++
    }
  }
  if (luzAfuera > 0) {
    return `${String(luzAfuera)} celdas de luz tocan el vacío: el contorno va todo en sombra, la luz va una celda adentro`
  }

  // 4 · SOMBRA QUE NO ES VOLUMEN — medida contra el CONTORNO del propio dibujo
  //     y no contra un porcentaje fijo. Ver `SOMBRA_DE_MAS`: una pieza fina es
  //     casi todo contorno, y el contorno tiene que ser sombra por la regla 3.
  let sombra = 0
  let contorno = 0
  for (let y = 0; y < filas.length; y++) {
    const f = filas[y]
    if (f === undefined) continue
    for (let x = 0; x < f.length; x++) {
      const ch = f.charAt(x)
      if (ch === '0') continue
      if (ch === '2') sombra++
      if (tocaElVacio(filas, y, x)) contorno++
    }
  }
  const permitida = contorno + tinta * SOMBRA_DE_MAS
  if (sombra > permitida) {
    return (
      `${String(Math.round((sombra / tinta) * 100))}% de la tinta es sombra y el contorno es sólo ` +
      `${String(Math.round((contorno / tinta) * 100))}%: eso no es volumen, es una mitad pintada`
    )
  }

  return undefined
}

/**
 * DÓNDE VIVEN LOS SPRITES. Cuatro métodos y ninguno sabe de dónde salen.
 *
 * Es la misma forma que `Deposito` en `@anima/store`, y por el mismo motivo
 * escrito allá: **la lectura del dibujo tiene que ser SÍNCRONA**. Si `dameYa`
 * pudiera devolver una promesa, dibujar un cuadro esperaría a la red y el mapa
 * se cortaría — que es justo lo que el usuario pidió que no pasara.
 *
 * Así que el contrato es explícito y tiene las dos mitades separadas:
 *
 *   `dameYa`   síncrono, mira lo que ya está en memoria. Nunca espera;
 *   `pedir`    encola una falta. Lo que pase después es de afuera.
 *
 * El adaptador de red y el de IndexedDB viven fuera de `src/`, igual que en
 * `store`: un paquete cuya única implementación no se puede correr en la suite
 * es un paquete que nadie prueba.
 */
export interface Sprites {
  /** Lo que YA está. Nunca espera, nunca falla: si no está, es `undefined`. */
  dameYa: (clave: ClaveDeSprite) => Sprite | undefined
  /** «Esto falta». Idempotente: pedir dos veces la misma clave es pedir una. */
  pedir: (clave: ClaveDeSprite) => void
  /** Lo que se pidió y todavía no llegó, para que el de afuera lo resuelva. */
  loQueFalta: () => readonly ClaveDeSprite[]
  /** Entra por la puerta o no entra. Devuelve si se guardó. */
  guardar: (clave: ClaveDeSprite, lado: number, raw: unknown) => Veredicto
}

/** La implementación que usa la suite, y la que un cliente usa como caché. */
export function spritesEnMemoria(iniciales: readonly Sprite[] = []): Sprites {
  const tengo = new Map<ClaveDeSprite, Sprite>()
  for (const s of iniciales) tengo.set(s.clave, s)
  const faltan = new Set<ClaveDeSprite>()

  return {
    dameYa: (clave) => tengo.get(clave),
    pedir: (clave) => {
      if (!tengo.has(clave)) faltan.add(clave)
    },
    // Ordenado: dos clientes que pidieron lo mismo tienen que preguntar en el
    // mismo orden, o el backend ve tráfico distinto para partidas idénticas.
    loQueFalta: () => [...faltan].sort(),
    guardar: (clave, lado, raw) => {
      const v = revisarSprite(raw, clave, lado)
      if (v.ok) {
        tengo.set(clave, v.sprite)
        faltan.delete(clave)
      }
      return v
    },
  }
}

/** El sprite como máscara, que es lo que el compositor sabe pintar. */
export function mascaraDe(s: Sprite): Mascara {
  return s.filas
}
