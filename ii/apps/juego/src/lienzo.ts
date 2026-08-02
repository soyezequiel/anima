// ─── DEL MAPA AL CANVAS ─────────────────────────────────────────────────────
//
// `mapaDe` devuelve colores en texto, uno por píxel. Esto los pone en pantalla,
// y es la única parte del juego que sabe que existe un `<canvas>`.
//
// ─── POR QUÉ `ImageData` Y NO `fillRect` POR CELDA ─────────────────────────
//
// Porque el suelo es el 89% del costo del cuadro —está medido en
// `dibujo/tests/banco-el-cuadro`— y con `fillRect` por celda de color contiguo
// habría un llamado al contexto por tramo, o sea decenas de miles por cuadro
// ahora que el suelo tiene granulado. Un `putImageData` es uno solo.
//
// ─── LA CACHÉ DE COLORES ES LO QUE HACE QUE ESTO SEA BARATO ────────────────
//
// Un mapa de 420×420 son 176.400 píxeles, y convertir `#b4afa3` a RGBA en cada
// uno sería parsear ciento setenta mil veces por cuadro un texto que se repite.
// La paleta entera del juego son unas pocas decenas de colores, así que la
// caché acierta casi siempre desde el segundo cuadro.

/** `#rrggbb` a un entero ABGR, que es como `Uint32Array` ve un píxel. */
function aABGR(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16)
  if (Number.isNaN(n)) return 0xff000000
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  // 0xAABBGGRR en little endian, que es lo que corre en todo lo que nos importa.
  return (255 << 24) | (b << 16) | (g << 8) | r
}

export class Lienzo {
  readonly #ctx: CanvasRenderingContext2D
  readonly #cache = new Map<string, number>()
  #img: ImageData | undefined
  #px: Uint32Array | undefined
  #escala = 0

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false })
    if (ctx === null) throw new Error('este navegador no da un contexto 2d')
    this.#ctx = ctx
    // Sin suavizado: el glifo es pixel art y el interpolado lo convierte en
    // manchas. Es la misma razón por la que el SVG lleva `crispEdges`.
    this.#ctx.imageSmoothingEnabled = false
  }

  /** Pinta un mapa. `escala` agranda cada píxel del mapa a N del canvas. */
  dibujar(mapa: readonly (readonly string[])[], escala: number): void {
    const lado = mapa.length
    if (lado === 0) return
    const canvas = this.#ctx.canvas
    if (canvas.width !== lado || canvas.height !== lado) {
      canvas.width = lado
      canvas.height = lado
      this.#img = this.#ctx.createImageData(lado, lado)
      this.#px = new Uint32Array(this.#img.data.buffer)
      this.#escala = 0
    }
    // El zoom es CSS y no `scale()` del contexto: el buffer sigue midiendo lo
    // que mide el mapa —así el costo del cuadro no cambia con el zoom, que es
    // el 89% del tiempo según el banco— y el agrandado lo hace el navegador con
    // `image-rendering: pixelated`, que para pixel art es exactamente lo que se
    // quiere. Se aplica sólo cuando CAMBIA, porque tocar `style` en cada cuadro
    // invalida el layout sesenta veces por segundo sin motivo.
    if (this.#escala !== escala) {
      this.#escala = escala
      canvas.style.width = `${String(lado * escala)}px`
      canvas.style.height = `${String(lado * escala)}px`
    }
    const img = this.#img
    const px = this.#px
    if (img === undefined || px === undefined) return

    for (let y = 0; y < lado; y++) {
      const fila = mapa[y]
      if (fila === undefined) continue
      const base = y * lado
      for (let x = 0; x < fila.length; x++) {
        const color = fila[x]
        if (color === undefined || color === '') {
          px[base + x] = 0xff000000
          continue
        }
        let v = this.#cache.get(color)
        if (v === undefined) {
          v = aABGR(color)
          this.#cache.set(color, v)
        }
        px[base + x] = v
      }
    }
    this.#ctx.putImageData(img, 0, 0)
  }
}
