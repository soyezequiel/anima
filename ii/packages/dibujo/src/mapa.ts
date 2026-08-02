// ─── EL MAPA: la escena entera, y la primera vez que algo se ve JUNTO ───────
//
// Todo lo que hay en este paquete se verificó pieza por pieza: la paleta contra
// pares de sustancias, la composición contra saltos de N, el contraste contra
// seis fondos. **Nadie había visto nunca veinte objetos juntos en una grilla**,
// y este proyecto ya tiene esa lección con nombre —*medir el catálogo no es
// medir el mundo*—: el fuego «no se propagaba» hasta que alguien ató dos
// cortezas.
//
// Lo que este archivo puede desmentir y ningún test anterior podía: que un mapa
// poblado se lea como una sopa de manchas aunque cada objeto por separado esté
// perfecto.
//
// ─── LAS TRES DECISIONES DE DIBUJO, Y NINGUNA INVENTA GEOMETRÍA ─────────────
//
//   1. **lo que alguien lleva en la mano NO se dibuja en el suelo.** `heldBy`
//      es estado publicado, y dibujar una vara en la celda de la criatura que la
//      lleva diría que está tirada ahí. Va al inventario, que es otra vista;
//   2. **cuando hay varios cuerpos en una celda se dibujan todos**, en orden de
//      id, del más chico al más grande por `porte` — así lo grande no tapa lo
//      chico. El orden por id es el que la escena ya garantiza canónico;
//   3. **la criatura lleva un realce** y eso no es cosmética inventada: la
//      escena dice qué cuerpo es de un actor (`ActorEnEscena.body`), así que
//      marcarlo es publicar algo que el mundo sabe. Sin esto, la criatura es un
//      terrón de carne indistinguible de un trozo de carne en el piso — su
//      cuerpo canónico es `carne`, una parte, bloque.

import type { Physics } from '@anima/physics'
import type { Clock, Escena } from '@anima/world'

import { glifoDe, pintar } from './componer.js'
import { granoDelSuelo, tonosDelSuelo } from './mundo.js'
import type { Sprites } from './sprite.js'

/** Un lienzo de colores. `''` es nada, aunque en un mapa el fondo siempre pinta. */
export interface Pintado {
  readonly lado: number
  readonly px: readonly (readonly string[])[]
}

/**
 * CUÁNTOS PÍXELES MIDE UNA CELDA, y por qué no es igual a la grilla del glifo.
 *
 * La grilla es 24 —lo eligió el banco de `la-medida-de-la-grilla`— y la celda es
 * 28. Los cuatro de diferencia son margen, y existen por una razón que se ve
 * apenas hay dos cosas al lado: un `bloque` llena su grilla entera, así que con
 * celda igual a grilla dos bloques vecinos se tocan y se leen como una sola
 * mancha. El margen es lo que hace que el suelo siga siendo visible entre las
 * cosas, y el suelo es la mitad de la información del mapa.
 */
export const CELDA = 28
const GRILLA = 24
const MARGEN = 2

const ORDEN_DE_PORTE = { menudo: 0, chico: 1, mediano: 2, grande: 3 }

/**
 * EL MAPA DE UNA ESCENA. Función pura: mismo estado, mismo dibujo.
 *
 * `reloj` entra porque el fondo depende de la fase, y no se saca de la escena
 * porque la escena no la publica — publica el tick. Quien dibuja tiene el reloj
 * (`relojDe`), igual que tiene la física.
 */
export function mapaDe(e: Escena, phys: Physics, reloj: Pick<Clock, 'phase'>, sprites?: Sprites): Pintado {
  const celdas = 2 * e.radio + 1
  const lado = celdas * CELDA
  const px: string[][] = []
  for (let y = 0; y < lado; y++) px.push(new Array<string>(lado).fill('#000000'))

  // ─── El suelo ──────────────────────────────────────────────────────────
  //
  // Granulado y no plano: son 225 celdas contra 10 cuerpos, así que el suelo es
  // casi toda la pantalla y un color liso la hace ver una planilla. El grano
  // sale de la posición ABSOLUTA en el mundo, así que no viaja con la cámara.
  for (const c of e.celdas) {
    const tonos = tonosDelSuelo(c, reloj)
    const cx = (c.at.x - e.foco.x + e.radio) * CELDA
    const cy = (c.at.y - e.foco.y + e.radio) * CELDA
    for (let y = 0; y < CELDA; y++) {
      const fila = px[cy + y]
      if (fila === undefined) continue
      for (let x = 0; x < CELDA; x++) {
        if (cx + x >= lado || cx + x < 0) continue
        fila[cx + x] = tonos[granoDelSuelo(c.at.x, c.at.y, x, y)]
      }
    }
  }

  // ─── Los cuerpos ───────────────────────────────────────────────────────
  //
  // Lo que está en una mano no va al suelo (decisión 1), y lo que queda se
  // ordena por porte para que lo grande no tape lo chico (decisión 2).
  const cuerposDeActores = new Set(e.actores.map((a) => a.body))
  const enElPiso = [...e.cuerpos.entries()].filter(([, c]) => c.heldBy === undefined)
  enElPiso.sort((a, b) => {
    // ─── LA CRIATURA VA ÚLTIMA, ENCIMA DE TODO ────────────────────────────
    //
    // Y no es una preferencia estética: se vio. Con el orden por porte a secas,
    // la criatura —60 kg, o sea porte `grande`— se pintaba primero y **la vara
    // de medio kilo que estaba en su misma celda la tapaba entera**. El
    // personaje desaparecía debajo de un palo.
    //
    // Es el mismo criterio que ya justificó el realce: la escena dice qué cuerpo
    // es de un agente, así que privilegiarlo publica un hecho del mundo.
    const actorA = cuerposDeActores.has(a[0]) ? 1 : 0
    const actorB = cuerposDeActores.has(b[0]) ? 1 : 0
    if (actorA !== actorB) return actorA - actorB

    const d = ORDEN_DE_PORTE[b[1].d.porte] - ORDEN_DE_PORTE[a[1].d.porte]
    // El desempate por id mantiene el dibujo canónico: sin él, dos cuerpos del
    // mismo porte podrían pintarse en distinto orden según cómo se armó el mapa.
    return d !== 0 ? d : a[0] < b[0] ? -1 : 1
  })
  for (const [id, cuerpo] of enElPiso) {
    const esAgente = cuerposDeActores.has(id)
    const lienzo = pintar(glifoDe(cuerpo.d, phys, GRILLA, sprites, esAgente))
    const cx = (cuerpo.d.at.x - e.foco.x + e.radio) * CELDA + MARGEN
    const cy = (cuerpo.d.at.y - e.foco.y + e.radio) * CELDA + MARGEN
    if (esAgente) marcar(px, cx - MARGEN, cy - MARGEN, lado)
    for (let y = 0; y < lienzo.length; y++) {
      const fila = lienzo[y]
      if (fila === undefined) continue
      for (let x = 0; x < fila.length; x++) {
        const color = fila[x]
        if (color === undefined || color === '') continue
        const destino = px[cy + y]
        if (destino === undefined || cx + x < 0 || cx + x >= lado) continue
        destino[cx + x] = color
      }
    }
  }

  return { lado, px }
}

/** El realce de la criatura: un marco en el borde de su celda. */
const REALCE = '#f0e7c8'

function marcar(px: string[][], cx: number, cy: number, lado: number): void {
  for (let i = 0; i < CELDA; i++) {
    for (const [x, y] of [
      [cx + i, cy],
      [cx + i, cy + CELDA - 1],
      [cx, cy + i],
      [cx + CELDA - 1, cy + i],
    ] as const) {
      const fila = px[y]
      if (fila === undefined || x < 0 || x >= lado) continue
      fila[x] = REALCE
    }
  }
}
