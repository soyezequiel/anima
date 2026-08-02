// ─── UN DIBUJANTE DE PRUEBA, Y NO SE PARECE A UN MODELO ─────────────────────
//
// **Esto no es el proveedor.** El proveedor de verdad es un modelo, vive afuera
// del mundo (ADR II-0024) y todavía no está conectado.
//
// Esto existe para una cosa: **poder probar el ciclo entero sin gastar una sola
// consulta**. El ciclo son cinco pasos y ninguno depende de que el dibujo sea
// lindo —falta, se pide, entra por la puerta, reemplaza en pantalla, se sube al
// depósito— así que un dibujante determinista los ejercita todos.
//
// Y está escrito para que **se note a simple vista que no es el modelo**: los
// dibujos son bandas diagonales obviamente artificiales. Si algún día alguien ve
// eso en una partida de verdad, sabe al toque que el proveedor no está conectado
// — que es mucho mejor que un dibujo mediocre y creíble.

import type { Proveedor } from '@anima/dibujo'

/** Hash entero y estable de un texto, para que la misma clave dé el mismo dibujo. */
function hashDe(texto: string): number {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function dibujanteDePrueba(): Proveedor {
  return {
    dibujar: (_prompt, clave) => {
      const lado = Number.parseInt(clave.split('/')[2] ?? '24', 10)
      const h = hashDe(clave)
      const paso = 2 + (h % 3)
      const grosor = 3 + (h % 4)
      const filas: string[] = []
      for (let y = 0; y < lado; y++) {
        let f = ''
        for (let x = 0; x < lado; x++) {
          // Bandas diagonales: obviamente hechas por una fórmula y no por nadie
          // que haya mirado una vara de madera.
          const banda = (x + y * paso + (h % 7)) % (grosor + 3)
          f += banda < grosor ? (banda === 0 ? '3' : banda === grosor - 1 ? '2' : '1') : '0'
        }
        filas.push(f)
      }
      return Promise.resolve(filas.join('\n'))
    },
  }
}
