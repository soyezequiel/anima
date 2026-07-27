// ─── EL BARRIDO NO ES UN CONTROL: ES UNA SEGUNDA IMPLEMENTACIÓN ──────────────
//
// `pnpm ii:barrido` se cita como evidencia de que un cambio en `leyes.ts` no
// movió nada — el ADR II-0010 lo hace («`pnpm ii:barrido` sigue dando 12/12
// sustancias con ventana y 5 óptimos distintos») y el tramo que lo escribió lo
// reporta como uno de sus controles.
//
// NO PUEDE SERLO. `banco/barrido-termico.mjs` es un archivo de 233 líneas SIN
// UNA SOLA IMPORTACIÓN: no toca `paso()`, no toca `leyTermica`, no lee el
// catálogo de sustancias del paquete. Su propio encabezado lo dice con todas las
// letras —«no hay motor: son las ecuaciones de la ley 1 evaluadas»— y evalúa una
// COPIA de esas ecuaciones, con su propia constante de pérdida y su propia tabla
// de sustancias escritas adentro.
//
// VERIFICADO A MANO, que es la única forma de decirlo: se revirtió
// `packages/physics/src/leyes.ts` al `HEAD` —o sea con `pelea` sin existir y la
// ley 1 relajando siempre— y `pnpm ii:barrido` imprimió LA MISMA TABLA fila por
// fila, los mismos 12/12 y los mismos 5 óptimos. Un control que da el mismo
// resultado con y sin la reparación no controla nada.
//
// Lo que el barrido SÍ hace, y por eso no se toca: demuestra que la ventana de
// cocción existe para las doce sustancias con una FUNCIÓN y no con una tabla por
// caso, que era la corrección B de la auditoría. Eso vale y es de diseño. Lo que
// no vale es citarlo como testigo de que el motor no cambió.
//
// Este test lo clava mecánicamente para que la próxima persona que lo cite como
// control se entere antes: si algún día el barrido pasa a importar del paquete,
// esto se pone rojo y ahí sí puede ser un control.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const RUTA = fileURLToPath(new URL('../banco/barrido-termico.mjs', import.meta.url))

describe('el barrido térmico no puede detectar un cambio en `leyes.ts`', () => {
  it('documentado · el script no importa NADA del paquete: es una copia de las ecuaciones', () => {
    const fuente = readFileSync(RUTA, 'utf8')
    // Ni `import`, ni `require`, ni `await import`. Ninguna vía.
    const importa = /^\s*import\s|^\s*const\s+\{[^}]*\}\s*=\s*require\(|\brequire\s*\(|\bawait\s+import\s*\(/m.test(
      fuente,
    )
    expect(importa, 'el barrido pasó a importar del paquete: ahora SÍ puede ser un control').toBe(
      false,
    )
    // Y lleva su propia constante de pérdida escrita a mano —el `/ 0.5` de
    // `T_eq = 15 + potencia × formFactor / 0.5`— que es la copia de
    // `H_PERDIDA` de `leyes.ts`. Dos implementaciones de una constante divergen.
    expect(fuente).toMatch(/0\.5/)
    console.log(
      '\n─── el barrido térmico ───\n' +
        'sin una sola importación: evalúa su propia copia de las ecuaciones de la ley 1.\n' +
        'Revirtiendo `leyes.ts` a HEAD, `pnpm ii:barrido` imprime la MISMA tabla.\n' +
        'Prueba que la ventana existe con una función; no prueba que el motor no cambió.\n',
    )
  })
})
