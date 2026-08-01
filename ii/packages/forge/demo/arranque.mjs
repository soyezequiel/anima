/**
 * EL ARRANQUE DEL HILO DE LA FRAGUA — Hito 8, tramo H.
 *
 * ─── Qué problema resuelve, y es de plomería ────────────────────────────────
 *
 * `ii/` se escribe en TypeScript y **no tiene paso de compilación**: los
 * `package.json` apuntan `exports` directo al `.ts` y quien resuelve las
 * extensiones es vitest. Node 24 sabe borrar los tipos solo, pero **no reescribe
 * `./x.js` a `./x.ts`**, y todo el repositorio importa con `.js` —que es lo que
 * TypeScript pide con `moduleResolution` de bundler—.
 *
 * O sea que un `new Worker(algo.ts)` muere en el primer import, que es lo que
 * pasó al escribir esto.
 *
 * Este archivo es el gancho que falta: un `resolve` que, cuando ve un
 * especificador relativo terminado en `.js` cuyo `.ts` existe al lado, devuelve
 * el `.ts`. Diez líneas, y le alcanza a todo el árbol.
 *
 * ─── Por qué acá y no en `src/` ─────────────────────────────────────────────
 *
 * Porque es de node y del arnés, no del mundo. Un `Worker` no existe en `src/`
 * por la regla 2 —no hay `await` ahí adentro— y esto además es `.mjs`: no tiene
 * tipos que borrar y se carga antes que nada.
 *
 * En el navegador este archivo no hace falta: el bundler ya resuelve.
 *
 * Se usa así, y el hilo va por variable de entorno para que el mismo arranque
 * sirva para cualquier trabajo:
 *
 *   new Worker(new URL('./arranque.mjs', import.meta.url),
 *              { env: { ...process.env, ANIMA_HILO: <ruta al .ts> } })
 */
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

registerHooks({
  resolve(especificador, contexto, siguiente) {
    if (especificador.startsWith('.') && especificador.endsWith('.js')) {
      const comoEsta = new URL(especificador, contexto.parentURL)
      const enTs = new URL(`${comoEsta.href.slice(0, -3)}.ts`)
      // Sólo si el `.ts` existe de verdad: un `.js` que existe se sigue
      // resolviendo como siempre, y así esto no puede romper nada que ande.
      if (existsSync(fileURLToPath(enTs))) return { url: enTs.href, shortCircuit: true }
    }
    return siguiente(especificador, contexto)
  },
})

const hilo = process.env.ANIMA_HILO
if (hilo === undefined) throw new Error('falta ANIMA_HILO: el arranque no sabe qué correr')
await import(pathToFileURL(hilo).href)
