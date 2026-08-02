// ─── HABLAR CON EL DEPÓSITO ─────────────────────────────────────────────────
//
// El adaptador de red del `DepositoRemoto`. Vive adentro de `src/` y no afuera
// —a diferencia del de IndexedDB en `@anima/store`— por una razón concreta:
// `fetch` existe en el navegador Y en node, así que esto se puede correr en la
// suite. La regla de `store` no era «los adaptadores van afuera», era «un
// paquete cuya única implementación no se puede correr en la suite es un
// paquete que nadie prueba». Acá sí se puede.
//
// Nada de esto sabe dibujar ni decidir: traduce cuatro rutas a tres métodos, y
// **deja que los errores salgan**. El que decide qué hacer cuando el depósito no
// está es el surtidor, que ya tiene esa regla escrita.

import type { DepositoRemoto } from './surtidor.js'
import type { ClaveDeSprite, Sprite } from './sprite.js'

/** Sin `/` final: se agrega acá para que dé igual cómo lo escribieron. */
export function depositoHttp(base: string, buscar: typeof fetch = fetch): DepositoRemoto {
  const raiz = base.endsWith('/') ? base.slice(0, -1) : base
  // La clave lleva barras (`vara/madera/24`), así que va escapada o el servidor
  // la lee como tres tramos de ruta.
  const donde = (clave: ClaveDeSprite): string => `${raiz}/sprites/${encodeURIComponent(clave)}`

  return {
    bajarTodo: async () => {
      const r = await buscar(`${raiz}/sprites`)
      if (!r.ok) throw new Error(`el depósito contestó ${String(r.status)}`)
      const cuerpo = (await r.json()) as { sprites?: unknown }
      return Array.isArray(cuerpo.sprites) ? (cuerpo.sprites as Sprite[]) : []
    },

    bajarUno: async (clave) => {
      const r = await buscar(donde(clave))
      // 404 no es un error: es «nadie dibujó eso todavía», que es el caso normal
      // al principio de todo. Tratarlo como falla llenaría los registros de
      // ruido justo cuando el depósito está vacío.
      if (r.status === 404) return undefined
      if (!r.ok) throw new Error(`el depósito contestó ${String(r.status)}`)
      return (await r.json()) as Sprite
    },

    subir: async (s) => {
      const r = await buscar(donde(s.clave), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filas: s.filas }),
      })
      // 200 es «ya estaba» y 201 es «entró»: las dos son éxito. Que otro haya
      // dibujado la misma pieza mientras tanto no es un problema, es el sistema
      // funcionando — y por eso el servidor contesta el que ya había.
      if (r.status !== 200 && r.status !== 201) {
        throw new Error(`el depósito rechazó el dibujo: ${String(r.status)}`)
      }
    },
  }
}
