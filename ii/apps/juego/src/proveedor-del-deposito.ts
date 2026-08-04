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
//
// ═══ Y AHORA HAY DOS CAMINOS, POR LA MISMA PUERTA ══════════════════════════
//
// Desde que el depósito puede no poner la cuenta (ADR 0089), la razón 1 de
// arriba se dio vuelta: la credencial que se usa es la del que juega, así que
// el navegador SÍ llama al modelo. Lo que no se movió ni un centímetro es la
// razón 2 — el prompt lo arma el depósito y el dibujo se valida y se guarda
// ahí— y por eso el camino largo son dos viajes y no uno: ver `el-sobre.ts`.
//
// Cuál se usa lo decide `llevar`: si el jugador tiene su API enchufada, la
// suya; si no, se le pide al depósito como siempre, y él contesta 501 cuando
// tampoco tiene con qué.

import type { Proveedor } from '@anima/dibujo'
import { porElSobre } from './el-sobre.js'
import type { LlevarAlModelo } from './mi-api.js'

/** Lo que las dos rutas contestan cuando salió bien. */
interface ConDibujo {
  readonly sprite?: { readonly filas?: string[] }
  readonly porque?: string
}

/**
 * `llevar` es una función y no un valor a propósito: el jugador puede enchufar
 * o desenchufar su API con el juego abierto, y un proveedor armado al arrancar
 * con la decisión ya tomada seguiría pidiéndole a quien ya no está.
 */
export function proveedorDelDeposito(
  base: string,
  llevar?: () => LlevarAlModelo | undefined,
): Proveedor {
  const raiz = base.endsWith('/') ? base.slice(0, -1) : base
  return {
    dibujar: async (_prompt, clave) => {
      // El prompt NO se manda: lo arma el depósito con `encargoDe` y la física.
      // Mandarlo desde acá dejaría que un cliente le dicte al modelo qué pedir,
      // y el depósito es compartido — lo que entra le queda a todos.
      const mio = llevar?.()
      const cuerpo =
        mio === undefined
          ? await unSoloTiro(raiz, clave)
          : ((await porElSobre({
              donde: raiz,
              pedido: { tipo: 'dibujar', clave },
              llevar: mio,
            })) as ConDibujo)
      const filas = cuerpo.sprite?.filas
      if (filas === undefined) throw new Error(cuerpo.porque ?? 'el depósito contestó sin dibujo')
      // Se devuelve como texto porque eso es lo que un proveedor entrega: el
      // camino de vuelta —limpiar, validar, guardar— es el mismo para todos.
      return filas.join('\n')
    },
  }
}

/** El camino de siempre: el depósito tiene modelo y hace el viaje él. */
async function unSoloTiro(raiz: string, clave: string): Promise<ConDibujo> {
  const r = await fetch(`${raiz}/dibujar/${encodeURIComponent(clave)}`, { method: 'POST' })
  const cuerpo = (await r.json()) as ConDibujo
  if (r.status !== 200 && r.status !== 201) {
    throw new Error(cuerpo.porque ?? `el depósito contestó ${String(r.status)}`)
  }
  return cuerpo
}
