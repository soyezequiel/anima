// ─── PEDIRLE EL DIBUJO AL DEPÓSITO ──────────────────────────────────────────
//
// El proveedor que usa el juego de verdad. No llama a ningún modelo: le pide al
// depósito, y el depósito llama a Codex.
//
// ─── POR QUÉ ESTA VUELTA Y NO IR DERECHO AL MODELO ─────────────────────────
//
// Por dos razones, y la segunda importa más de lo que parece:
//
//   1. **las credenciales no viajan al navegador.** Cualquiera que abra el
//      juego se las llevaría, y Codex además es un proceso: no hay API que una
//      página pueda llamar;
//   2. **el dibujo se valida y se guarda donde se pidió.** Así nunca existe un
//      sprite que una pantalla usó y el depósito no tenga — que es la clase de
//      diferencia que aparece meses después, cuando dos jugadores ven cosas
//      distintas y nadie sabe por qué.
//
// Del lado del cliente el sprite igual pasa por la puerta otra vez, en
// `recibir`. No es desconfianza del propio backend: es que un dibujo es dato
// externo venga de donde venga, y esa regla no tiene excepciones cómodas.

import type { Proveedor } from '@anima/dibujo'

export function proveedorDelDeposito(base: string): Proveedor {
  const raiz = base.endsWith('/') ? base.slice(0, -1) : base
  return {
    dibujar: async (_prompt, clave) => {
      // El prompt NO se manda: lo arma el depósito con `encargoDe` y la física.
      // Mandarlo desde acá dejaría que un cliente le dicte al modelo qué pedir,
      // y el depósito es compartido — lo que entra le queda a todos.
      const r = await fetch(`${raiz}/dibujar/${encodeURIComponent(clave)}`, { method: 'POST' })
      const cuerpo = (await r.json()) as { sprite?: { filas?: string[] }; porque?: string }
      if (r.status !== 200 && r.status !== 201) {
        throw new Error(cuerpo.porque ?? `el depósito contestó ${String(r.status)}`)
      }
      const filas = cuerpo.sprite?.filas
      if (filas === undefined) throw new Error('el depósito contestó sin dibujo')
      // Se devuelve como texto porque eso es lo que un proveedor entrega: el
      // camino de vuelta —limpiar, validar, guardar— es el mismo para todos.
      return filas.join('\n')
    },
  }
}
