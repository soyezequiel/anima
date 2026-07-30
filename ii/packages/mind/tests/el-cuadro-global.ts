// EL BORRADO DEL CUADERNO, ANTES DE QUE ARRANQUE UN SOLO ARCHIVO
//
// Corre en el proceso principal de vitest, una vez, ANTES de que se forkee ningún
// worker (`globalSetup` de `vitest.config.ts`). Es lo único que hace, y es lo que
// hace que el cuadro no pueda mentir: si quedara el `.json` de la corrida anterior,
// el archivo del cuadro lo leería como si fuera de ésta y publicaría un número
// medido en otro árbol. En este proyecto ya hubo dos veces un «exit 0» sobre un
// árbol rojo; un cuadro con números de ayer sería la misma clase de daño.
//
// Va acá y no en un `beforeAll` de algún test porque **ningún archivo sabe si es el
// primero**: cinco workers arrancando a la vez se pisarían el borrado unos a otros.

import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const CUADERNO = fileURLToPath(new URL('../node_modules/.cuaderno/', import.meta.url))

export function setup(): void {
  rmSync(CUADERNO, { recursive: true, force: true })
}
