/**
 * Lo poquito que las quince comparten. Nada acá agrega capacidad: son cuentas
 * sobre lo que `Ctx` ya devuelve.
 *
 * HALLAZGO — `distancia` tendría que ser de la API, y ahora se puede decir por
 * qué con un número y no con una opinión. `aMano()` de `stepWorld` usa
 * **Chebyshev ≤ 1** (`world/src/step.ts:714`), y `goTo(t, { within })` se juzga
 * con la misma métrica. La superficie no la nombra en ninguna parte, así que
 * cada habilidad la va a adivinar: Manhattan, euclídea, Chebyshev. Dos
 * habilidades con dos métricas contra el mismo `within` es un bug que ni `tsc`
 * ni el smoke ven, y que aparece en la grilla como «a veces no llega».
 *
 * Acá está bien porque se fue a mirar el motor. El modelo no va a poder.
 */

import type { BodyView, Cell, SelfView } from '../ctx.js'

/** Chebyshev, la métrica que usa `aMano()` del mundo. Verificada, no supuesta. */
export function distancia(a: Cell, b: Cell): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.max(dx < 0 ? -dx : dx, dy < 0 ? -dy : dy)
}

/**
 * Ordena por cercanía a `desde`, y desempata por `id`.
 *
 * El desempate no es prolijidad. `see()` no promete orden, y sin desempate dos
 * corridas del mismo mundo pueden elegir cuerpos distintos: se cae el criterio
 * del Hito 4 «una habilidad corrida dos veces da el mismo hash». Se comparan
 * los ids con `<` y no con `localeCompare`, que es la regla 2 de `ii/` y
 * además lo que hace `compararTexto` en `@anima/world`.
 */
export function porCercania<T extends { readonly at: Cell; readonly id: string }>(
  xs: readonly T[],
  desde: Cell,
): T[] {
  return [...xs].sort((p, q) => {
    const d = distancia(p.at, desde) - distancia(q.at, desde)
    return d !== 0 ? d : p.id < q.id ? -1 : p.id > q.id ? 1 : 0
  })
}

/** ¿Lo tengo en las manos? Por id, porque las vistas se rearman cada tick. */
export function enLaMano(self: SelfView, b: BodyView): boolean {
  return self.holding.some((x) => x.id === b.id)
}

/** ¿Está al alcance? La condición de `aMano()` del mundo, tal cual: en la mano,
 *  o a Chebyshev ≤ 1. Es la precondición de `take`, `eat` y `put`. */
export function alAlcance(self: SelfView, b: BodyView): boolean {
  return enLaMano(self, b) || distancia(self.at, b.at) <= 1
}

/**
 * El anillo de celdas a distancia exacta `r`.
 *
 * Existe por el hueco de enumeración: `qAt` acepta cualquier `Cell` y no hay
 * ninguna forma de PEDIR celdas. Ni `cellsAround`, ni un iterador de la región
 * percibida. Buscar agua —que el propio `Ctx` dice que es «`qAt` o `recall`,
 * nunca `see`»— se hace inventando coordenadas con aritmética y preguntando de
 * a una. Ver `guarecerse.ts` y `huir-del-dolor.ts`.
 */
export function anillo(centro: Cell, r: number): Cell[] {
  if (r <= 0) return [{ x: centro.x, y: centro.y }]
  const out: Cell[] = []
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      const m = Math.max(dx < 0 ? -dx : dx, dy < 0 ? -dy : dy)
      if (m === r) out.push({ x: centro.x + dx, y: centro.y + dy })
    }
  }
  return out
}

/** El disco de radio `r` alrededor de un centro, del más cercano al más lejano. */
export function disco(centro: Cell, r: number): Cell[] {
  const out: Cell[] = [{ x: centro.x, y: centro.y }]
  for (let i = 1; i <= r; i++) for (const c of anillo(centro, i)) out.push(c)
  return out
}
