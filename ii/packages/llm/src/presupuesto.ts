/**
 * EL CONTADOR DE DOS CARRILES — Hito 8, tramo A.
 *
 * ─── LO PRIMERO: POR DEFECTO NO FRENA NADA ──────────────────────────────────
 *
 * **Decisión del usuario: la criatura aprende todo lo que quiera.** La cuota
 * arranca en `SIN_LIMITE` y `puedo()` contesta que sí siempre. Este módulo NO
 * es una jaula: es un **contador**.
 *
 * Y no es que el freno se sacó y quedó el resto: el freno **existe apagado**,
 * porque el mismo mecanismo con un techo puesto es lo que el criterio pide para
 * CI —«el episodio completo no supera N consultas»—. Poner un techo es un gesto
 * de quien corre el test, no del juego.
 *
 * ─── QUÉ PROTEGÍA EL LÍMITE, que es lo que hay que conservar ────────────────
 *
 * El plan lo dice con todas las letras: *«si no se diseña temprano, **la factura
 * decide la arquitectura por vos**»*. Y hay un dato duro: **nadie sabe todavía
 * cuánto sale un episodio de la fragua**. El contador es cómo se averigua; sin
 * él se averigua por el resumen de la tarjeta.
 *
 * Lo que se sacó es el TOPE. Lo que se conservó es la MEDICIÓN, y con ella el
 * único guardián que importa: que un cambio que multiplique las llamadas —de 8
 * a 400— se vea en un test y no en la factura.
 *
 * ─── Por qué siguen siendo DOS carriles, ahora que no compiten ──────────────
 *
 * Ya no es para que uno no mate de hambre al otro: sin tope no hay hambre.
 * Es porque **«gastamos 3000 milésimas» no dice nada y «la fragua gastó 2800 y
 * el chat 200» sí**. Los dos consumidores tienen costos por operación muy
 * distintos, y sumarlos esconde justamente al que se fue de escala.
 *
 * ─── El planteo original, que se conserva porque explica de dónde salió ─────
 *
 * Porque los dos consumidores tienen urgencias opuestas y **el presupuesto se
 * escribió para uno solo**. Está anotado desde la tercera enmienda del ADR
 * II-0024:
 *
 * | | tarda | ¿puede esperar? |
 * |---|---|---|
 * | la fragua | 6-25 s (caso frío) | **sí** — la criatura sigue con lo que sabe |
 * | el chat | no puede hacer esperar | **no** — es el punto 2 del Hito 6 |
 *
 * Lo decidió el usuario: **cuotas separadas**. Ninguno puede matar de hambre al
 * otro, y la política de descarte deja de ser una pregunta — cada uno se
 * descarta contra lo suyo.
 *
 * Las dos alternativas se descartaron con su argumento escrito (decisión D1 de
 * `ii/docs/hito-8-la-fragua.md`), y ninguna era mala: la fragua sin cuota **no
 * hace nada**, y el chat sin cuota entiende 9% en vez de 30% pero **sigue
 * contestando**. Cuotas separadas compra predictibilidad a cambio de plata
 * ociosa cuando un carril no usa la suya.
 *
 * ─── EL REPARTO NO SE ELIGE ACÁ ─────────────────────────────────────────────
 *
 * Es la regla que este repo ya pagó tres veces —el `80%`, el `200` y el `110`
 * del Hito 6—: **un número puesto antes de medir defiende otra cosa de la que
 * parece**. Así que el reparto entra por parámetro, y lo que este archivo
 * garantiza no es el número sino el invariante:
 *
 *   **ningún carril pasa de lo suyo, y con su tanque en cero no dispara ni una
 *   consulta.**
 *
 * ─── Y por qué esto NO llama a nadie ────────────────────────────────────────
 *
 * Un presupuesto que además dispara la consulta es un presupuesto que no se
 * puede probar sin red. Acá se pide permiso y se avisa qué se gastó; **quien
 * llama es otro**. Es la misma frontera que el Hito 6 fijó para el chat —el
 * paquete describe, el llamador espera— y por eso este módulo no tiene una sola
 * dependencia.
 */

/** Los dos consumidores. Cerrado a propósito: un tercero es una decisión, no un `string`. */
export type Carril = 'fragua' | 'chat'

export const CARRILES: readonly Carril[] = ['fragua', 'chat']

/**
 * Lo que cuesta una consulta, y por qué se cuenta en DOS unidades.
 *
 * `consultas` es lo que el criterio afirma —«el episodio completo no supera N
 * consultas»— y es lo único que se puede contar sin hablar con nadie.
 *
 * `milesimas` es plata: milésimas de dólar, entero, porque el costo real se
 * mide en centavos con decimales (el Hito 6 midió **US$ 0,0158 por frase**) y
 * un flotante acumulado a lo largo de una sesión deriva. Entero y en milésimas
 * no deriva.
 */
export interface Costo {
  readonly consultas: number
  readonly milesimas: number
}

export const NADA: Costo = { consultas: 0, milesimas: 0 }

/**
 * Un techo. `Infinity` en cualquiera de los dos campos quiere decir «no frena».
 *
 * `Infinity` y no `undefined` para que la aritmética de `queda` y `puedo` sea
 * la misma con techo y sin techo: `costo > Infinity` es `false`, así que el
 * camino sin límite **no es una rama aparte** y no puede divergir del que se
 * prueba en CI.
 */
export interface Cuota {
  readonly consultas: number
  readonly milesimas: number
}

export type Motivo = 'sin-consultas' | 'sin-plata'

export type Permiso =
  | { readonly k: 'dale'; readonly queda: Cuota }
  | { readonly k: 'no'; readonly porque: Motivo; readonly queda: Cuota }

/**
 * EL PRESUPUESTO DE UNA SESIÓN.
 *
 * Mutable y encerrado, como `CanalDeHabla` y `EncargoEnCurso`, y por lo mismo:
 * es un registro que cambia en cada consulta, y uno inmutable que devuelve una
 * copia por gasto convierte una sesión en una copia por gasto.
 */
export class Presupuesto {
  readonly #tope: Readonly<Record<Carril, Cuota>>
  readonly #gastado: Record<Carril, Costo> = { fragua: NADA, chat: NADA }
  /** Lo que se pidió y se negó, por carril. Es lo que dice si el reparto sirve. */
  readonly #negados: Record<Carril, number> = { fragua: 0, chat: 0 }

  constructor(tope: Readonly<Record<Carril, Cuota>>) {
    this.#tope = tope
  }

  gastado(c: Carril): Costo {
    return this.#gastado[c]
  }

  negados(c: Carril): number {
    return this.#negados[c]
  }

  queda(c: Carril): Cuota {
    const t = this.#tope[c]
    const g = this.#gastado[c]
    return {
      consultas: Math.max(0, t.consultas - g.consultas),
      milesimas: Math.max(0, t.milesimas - g.milesimas),
    }
  }

  /**
   * ¿PUEDO GASTAR ESTO?
   *
   * Se pregunta ANTES de la consulta y con lo que la consulta va a costar como
   * COTA SUPERIOR. Preguntar después sería un aviso, no una puerta, y el punto 8
   * del criterio pide una puerta: *«con la cuota agotada, la cola no dispara ni
   * una consulta»*.
   *
   * No descuenta nada: pedir permiso y gastar son dos gestos, porque entre uno y
   * otro la consulta puede fallar y una que falló no gastó lo que prometía.
   */
  puedo(c: Carril, costo: Costo): Permiso {
    const q = this.queda(c)
    if (costo.consultas > q.consultas) {
      this.#negados[c] += 1
      return { k: 'no', porque: 'sin-consultas', queda: q }
    }
    if (costo.milesimas > q.milesimas) {
      this.#negados[c] += 1
      return { k: 'no', porque: 'sin-plata', queda: q }
    }
    return { k: 'dale', queda: q }
  }

  /**
   * LO QUE DE VERDAD SALIÓ, después de la consulta.
   *
   * Se cobra lo REAL y no lo estimado, y por eso `puedo` no descuenta: una
   * consulta que se estimó cara y salió barata no tiene por qué dejar cuota
   * muerta hasta el final de la sesión.
   *
   * Y **se cobra aunque pase el tope**. Un gasto que el mundo ya hizo no se
   * puede no contar: esconderlo haría que `queda` mienta y que el carril siga
   * pidiendo. Lo que la cota impide es AUTORIZAR, no ocurrir.
   */
  gastar(c: Carril, costo: Costo): void {
    const g = this.#gastado[c]
    this.#gastado[c] = {
      consultas: g.consultas + costo.consultas,
      milesimas: g.milesimas + costo.milesimas,
    }
  }

  /** ¿Este carril se quedó sin nada? Lo lee la cola para no encolar al pedo. */
  agotado(c: Carril): boolean {
    const q = this.queda(c)
    return q.consultas <= 0 || q.milesimas <= 0
  }

  /**
   * EL INVARIANTE, para que un test lo pueda afirmar de una.
   *
   * Que un carril haya gastado de más NO es imposible —`gastar` cobra lo real—
   * pero sí es un error de quien llama: gastó sin permiso. Esto lo detecta.
   */
  seExcedio(c: Carril): boolean {
    const t = this.#tope[c]
    const g = this.#gastado[c]
    return g.consultas > t.consultas || g.milesimas > t.milesimas
  }

  /**
   * Un renglón por carril, para el informe de sesión.
   *
   * El techo sale como `—` cuando no hay: `8/Infinity` es ruido, y peor —invita
   * a leerlo como que hay un tope raro en vez de que no hay ninguno.
   */
  informe(): string {
    const techo = (n: number): string => (Number.isFinite(n) ? String(n) : '—')
    return CARRILES.map((c) => {
      const g = this.#gastado[c]
      const t = this.#tope[c]
      return (
        `${c.padEnd(7)} ${String(g.consultas).padStart(5)} / ${techo(t.consultas).padEnd(6)} consultas · ` +
        `${String(g.milesimas).padStart(6)} / ${techo(t.milesimas).padEnd(6)} milésimas · ` +
        `${String(this.#negados[c])} negadas`
      )
    }).join('\n')
  }
}

/**
 * EL DEFECTO: NO FRENA NADA. Es lo que decidió el usuario.
 *
 * La criatura aprende todo lo que quiera y el chat consulta todo lo que quiera.
 * Lo único que este objeto hace es dejar que el contador cuente.
 */
export const SIN_LIMITE: Readonly<Record<Carril, Cuota>> = {
  fragua: { consultas: Infinity, milesimas: Infinity },
  chat: { consultas: Infinity, milesimas: Infinity },
}

/** Un presupuesto que no frena. Es el que usa el juego. */
export function sinLimite(): Presupuesto {
  return new Presupuesto(SIN_LIMITE)
}

/**
 * UN TECHO PARA CI, y **no es un número del juego**.
 *
 * El criterio pide que «el episodio completo no supere N consultas», y eso es un
 * guardián de regresión: si un cambio lleva un episodio de 8 consultas a 400,
 * tiene que verse en un test y no en la factura.
 *
 * **El número está puesto a dedo y se dice.** Nadie midió todavía cuánto sale un
 * episodio de la fragua —de eso se trata el hito— así que esto es un punto de
 * partida generoso, no una medición. La primera corrida de verdad lo va a mover,
 * igual que la línea base de cobertura del chat (ADR II-0024, § 2).
 */
export const TECHO_DE_CI: Readonly<Record<Carril, Cuota>> = {
  fragua: { consultas: 40, milesimas: 4000 },
  chat: { consultas: 200, milesimas: 4000 },
}
