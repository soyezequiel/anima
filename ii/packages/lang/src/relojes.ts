/**
 * LOS TRES RELOJES — y son tres porque miden cosas distintas.
 *
 * El documento de arquitectura los nombra y advierte, en el mismo párrafo, cuál
 * es el error de leerlos juntos: «los números lindos eran todos del caso
 * caliente, y la demo es el caso frío».
 *
 * | reloj | qué mide | presupuesto |
 * |---|---|---|
 * | `msHastaPrimerMovimiento` | del mensaje al primer cambio visible en el mundo | **p95 < 150 ms** |
 * | `msHastaAccionPertinente` | del mensaje a la primera acción que va al grano | frío: segundos |
 * | `consistenciaDelPrimerGesto` | primer gesto coherente con la conducta final | **≥ 0,85** |
 *
 * El tercero es el que decide si preposicionarse funciona o parece estupidez. Si
 * baja de 0,85 **la especulación se apaga hasta que suba**: es la única defensa
 * medible que el documento le pone a la apuesta de moverse antes de entender del
 * todo.
 *
 * ─── POR QUÉ EL CRONÓMETRO ENTRA POR PARÁMETRO ──────────────────────────────
 *
 * Porque `performance.` está prohibido en `src/` por la regla 2, y no es un
 * capricho: un paquete determinista que lee el reloj del sistema deja de dar el
 * mismo resultado dos veces. Medir es del banco, no del léxico.
 *
 * La solución no la inventa este archivo: es la misma que `perceive/src/bucle.ts`
 * ya usa para `ticksPerdidos`, que necesita saber si un tick llegó tarde y **no
 * llama al reloj**, lo recibe (`RelojDePared`). La frontera con el reloj del
 * sistema es el llamador; adentro de `src/` no hay ni un `Date.now`.
 *
 * ─── UNA TRAMPA QUE EL PROYECTO YA COBRÓ, y hay que decirla acá ─────────────
 *
 * `ticksPerdidos` **por omisión no puede subir**: su mitad interesante se mide
 * contra un `RelojDePared` que `PartidaOptions` deja en `undefined`. Se corrieron
 * 600 ticks con una mente y dio 0 perdidos, 0 por tiempo, 0 por falla — sin reloj
 * puesto. **Ese cero no dice «llegamos a horario», dice «nadie miró».**
 *
 * Los relojes de acá tienen el mismo riesgo y por eso `Muestras` arranca vacío y
 * `resumen()` **devuelve `undefined` cuando no hay muestras** en vez de cero. Un
 * cero es una medición; la ausencia de medición no es un cero.
 */

/** Un milisegundo medido afuera. Quien lo produce vive fuera de `src/`. */
export type Ms = number

export interface Resumen {
  readonly n: number
  readonly p50: Ms
  readonly p95: Ms
  readonly p99: Ms
  readonly max: Ms
}

/**
 * Un percentil sobre una lista ordenada, por el método del índice más cercano
 * hacia arriba.
 *
 * Sin interpolar y sin `Math.round` sobre un producto: `Math.ceil(p·n) - 1`
 * acotado, que es una cuenta entera y da lo mismo en todos los motores. La
 * interpolación entre dos muestras inventa un número que no se midió, y en una
 * cola larga —que es justo donde importa— inventa hacia abajo.
 */
function percentil(ordenadas: readonly Ms[], p: number): Ms {
  const n = ordenadas.length
  if (n === 0) return 0
  let i = Math.ceil(p * n) - 1
  if (i < 0) i = 0
  if (i >= n) i = n - 1
  return ordenadas[i] ?? 0
}

/**
 * UN RELOJ: una bolsa de muestras que sabe resumirse.
 *
 * Mutable a propósito y con la mutación encerrada: es un acumulador, y un
 * acumulador inmutable que devuelve una copia por muestra convierte 200 frases
 * en 200 arrays. Lo que sí es inmutable es lo que sale.
 */
export class Reloj {
  readonly #muestras: Ms[] = []

  anotar(ms: Ms): void {
    this.#muestras.push(ms)
  }

  get n(): number {
    return this.#muestras.length
  }

  /**
   * `undefined` sin muestras, y no un resumen de ceros. Ver el encabezado: la
   * ausencia de medición no es un cero, y este proyecto ya publicó un cero que
   * quería decir «nadie miró».
   */
  resumen(): Resumen | undefined {
    if (this.#muestras.length === 0) return undefined
    const o = [...this.#muestras].sort((a, b) => a - b)
    return {
      n: o.length,
      p50: percentil(o, 0.5),
      p95: percentil(o, 0.95),
      p99: percentil(o, 0.99),
      max: o[o.length - 1] ?? 0,
    }
  }
}

/**
 * LA CONSISTENCIA DEL PRIMER GESTO.
 *
 * `órdenes donde el primer gesto fue coherente con la conducta final / órdenes
 * totales`, tal cual la define el documento.
 *
 * «Coherente» lo decide quien mide y no este archivo, porque depende del mundo:
 * acá se cuenta. Lo único que aporta es negarse a devolver un número cuando no
 * hay nada contado, por la misma razón que `Reloj.resumen`.
 */
export class Consistencia {
  #coherentes = 0
  #total = 0

  anotar(coherente: boolean): void {
    this.#total++
    if (coherente) this.#coherentes++
  }

  get total(): number {
    return this.#total
  }

  /** `undefined` sin órdenes. Un 0/0 no vale 0 ni vale 1. */
  valor(): number | undefined {
    return this.#total === 0 ? undefined : this.#coherentes / this.#total
  }
}

/** Los tres, juntos, que es como se leen. */
export interface Relojes {
  readonly hastaPrimerMovimiento: Reloj
  readonly hastaAccionPertinente: Reloj
  readonly consistenciaDelPrimerGesto: Consistencia
}

export function relojes(): Relojes {
  return {
    hastaPrimerMovimiento: new Reloj(),
    hastaAccionPertinente: new Reloj(),
    consistenciaDelPrimerGesto: new Consistencia(),
  }
}

/**
 * ¿DOS CORRIDAS SON LA MISMA, O UNA TIENE COLA?
 *
 * Es el punto 2 del criterio del hito hecho función, y es la única forma de
 * afirmarlo que no depende de qué tan rápida sea la máquina: **no se compara
 * contra un techo, se comparan dos corridas entre sí**.
 *
 * `tolerancia` es relativa y no absoluta por el mismo motivo. El valor por
 * omisión, 0,5, es deliberadamente ancho: lo que este portón tiene que atrapar
 * es un proveedor en el camino crítico, que aporta cientos de milisegundos
 * contra un p95 de decenas — o sea un factor de 10 o más, no un 50%. Un umbral
 * apretado convertiría el ruido de la máquina en rojos y enseñaría a ignorarlo.
 */
export function mismaCorrida(a: Resumen, b: Resumen, tolerancia = 0.5): boolean {
  const peor = a.p95 > b.p95 ? a.p95 : b.p95
  const mejor = a.p95 > b.p95 ? b.p95 : a.p95
  // Con los dos en cero no hay diferencia que medir, y dividir daría `NaN`.
  if (peor === 0) return true
  return (peor - mejor) / peor <= tolerancia
}
