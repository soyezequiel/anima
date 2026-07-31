// ─── LA CONFIGURACIÓN QUE COMPARTEN LOS NUEVE PAQUETES ───────────────────────
//
// Existe por UNA cosa, y conviene que se lea entera antes de agregarle una
// segunda: **la paciencia del arnés no puede ser la de vitest**.
//
// ─── EL NÚMERO Y DE DÓNDE SALE ──────────────────────────────────────────────
//
// El `testTimeout` por omisión de vitest son 5 s. Es un valor de la herramienta,
// no una decisión de este proyecto, y para esta suite es demasiado corto por una
// razón medida: **correr los ocho paquetes EN PARALELO baja la verificación de
// 239 s a ~72 s**, pero ahí dentro hay decenas de bloques que lanzan `tsc`,
// decretan cientos de chunks o corren decenas de miles de ticks. Con la máquina
// libre entran en 5 s; con ocho vitest peleándose 16 hilos, no. Medido en dos
// corridas seguidas: los bloques que se pasaban eran DISTINTOS cada vez —4,6 s,
// 5,5 s, 6,6 s, 12 s, 26 s— o sea que anotarlos de a uno es un juego de topos.
//
// ─── POR QUÉ SUBIRLO NO AFLOJA NINGÚN CRITERIO ──────────────────────────────
//
// Porque **el timeout nunca fue una medición de este proyecto**. Todo lo que acá
// se afirma sobre el reloj vive en un `expect` explícito y detrás de
// `ANIMA_BANCO=1`, con la regla escrita desde el Hito 2: se imprime siempre, se
// afirma sólo midiendo en serio (`world/tests/banco-el-tick.test.ts:165`). El
// timeout es otra cosa: es cuánto espera el ANDAMIO antes de dar por colgado un
// bloque. Un bloque que tarda 12 s bajo contención no falló — lo mataron.
//
// Lo que sí sigue cazando: un `while(true)` de verdad. Dos minutos es dos órdenes
// de magnitud más que el bloque más lento medido (26 s) y sigue siendo mucho
// menos que lo que tarda una suite colgada en avisar.
//
// ─── Y LO QUE NO SE TOCA, A PROPÓSITO ───────────────────────────────────────
//
// El paralelismo por archivo, el pool de forks y el aislamiento de módulos
// quedan en sus valores por omisión: son justamente lo que hace que repartir un
// banco en cinco archivos sirva para algo (ver `juez/tests/azar.ts` y
// `juez/tests/el-banco-de-la-mente.ts`).

import { defineConfig } from 'vitest/config'

/** Dos minutos. Ver el encabezado: es paciencia del arnés, no un criterio. */
export const TOPE_DE_PACIENCIA_MS = 120_000

export default defineConfig({
  test: {
    testTimeout: TOPE_DE_PACIENCIA_MS,
    hookTimeout: TOPE_DE_PACIENCIA_MS,
  },
})
