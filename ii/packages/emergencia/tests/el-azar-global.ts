// EL BORRADO DE LO GUARDADO DEL CONTROL, ANTES DE QUE ARRANQUE UN SOLO ARCHIVO
//
// Corre en el proceso principal de vitest, una vez, antes de que se forkee ningún
// worker (`globalSetup` de `vitest.config.ts`). Es lo único que hace, y es lo que
// hace que el reparto del control no pueda mentir.
//
// El control del azar se guarda por semilla en `node_modules/.azar/` para que cinco
// archivos se lo repartan (ver `azar.ts`). Si quedara lo de la corrida anterior, la
// tabla del control saldría medida sobre OTRO árbol —otra física, otro decreto, otra
// mente— y nadie lo notaría, porque el número tiene exactamente la misma pinta. Este
// proyecto ya publicó dos veces un «exit 0» sobre un árbol rojo; un control con
// veredictos de ayer sería la misma clase de daño y más difícil de ver.
//
// Va acá y no en un `beforeAll` porque **ningún archivo sabe si es el primero**:
// cinco tandas arrancando a la vez se borrarían el trabajo unas a otras.
//
// Y sí, esto quiere decir que lo guardado NO sobrevive de una corrida a la otra, a
// propósito: es un reparto adentro de una corrida, no un caché de resultados.

import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const GUARDADO = fileURLToPath(new URL('../node_modules/.azar/', import.meta.url))

export function setup(): void {
  rmSync(GUARDADO, { recursive: true, force: true })
}
