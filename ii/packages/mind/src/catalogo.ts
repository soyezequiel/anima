// ─── LO QUE LA MENTE DERIVA DEL CATÁLOGO, por epoch y no al cargar ──────────
//
// La mente lee la tabla de esquemas para dos cosas, y las dos las precalculaba al
// CARGAR EL MÓDULO con el mismo comentario justificándolo: «`SCHEMA_INDEX` es una
// constante de `@anima/plan`». El Gate 5→6 vuelve falsa esa frase: con overlay de
// sesión, la tabla es de la partida.
//
// Este archivo tiene una sola función y es el remplazo de ese «al cargar».
//
// ─── POR QUÉ SIGUE HABIENDO UNA CACHÉ, Y POR QUÉ ES SEGURA ──────────────────
//
// El precalculado no existía por gusto: parsear las firmas por candidato y por
// tick es el peldaño D3 pagando una expresión regular por cuerpo mirado, y está
// escrito en el porqué de las dos tablas. Sacarlo entero cambiaría el costo del
// tick, que es un número del criterio.
//
// Lo que queda es una caché de UNA entrada, con la llave `catalogEpoch`. Es
// estado mutable de módulo, que es justo lo que este gate vino a matar, así que
// hay que decir por qué éste no es lo mismo:
//
//   · **no es autoridad, es un resultado.** El valor es una función pura del
//     epoch; en un fallo se recalcula y sale idéntico. Borrar la caché entera no
//     cambia una sola respuesta, sólo el tiempo;
//   · **no hay contaminación entre partidas.** Dos vistas con epochs distintos
//     no comparten la entrada: la segunda desaloja a la primera. Lo peor que pasa
//     con dos partidas alternando por tick es que las dos recalculan siempre, o
//     sea el costo de no tener caché;
//   · **la llave es del CONTENIDO** (ver `catalogEpoch` en `@anima/plan`), no un
//     contador, así que dos catálogos distintos no pueden compartir entrada.
//
// El control de las dos primeras viñetas está escrito y corre: ver el bloque «la
// caché por epoch» de `tests/el-catalogo-llega-a-la-mente.test.ts`.

import type { PlannerCatalogView } from '@anima/plan'

/**
 * Lo que se calculaba al cargar, calculado UNA vez por catálogo.
 *
 * Se envuelve la función y no se guarda un `Map` a propósito: un `Map` crecería
 * con cada catálogo que la partida haya visto y nadie lo vaciaría nunca. Una
 * entrada alcanza porque una mente juega una partida por vez.
 */
export function porEpoch<T>(calcular: (c: PlannerCatalogView) => T): (c: PlannerCatalogView) => T {
  let llave: number | undefined
  let guardado: T | undefined
  return (c: PlannerCatalogView): T => {
    if (llave !== c.catalogEpoch || guardado === undefined) {
      guardado = calcular(c)
      llave = c.catalogEpoch
    }
    return guardado
  }
}
